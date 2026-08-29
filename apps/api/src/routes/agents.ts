import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import {
  createHandoffBodySchema,
  EVENT_NAMES,
  heartbeatBodySchema,
  presenceBodySchema,
  registerAgentBodySchema,
} from "@contextos/shared";
import { denyUnlessWriter, getProjectAccess, isHuman, isOwnerRole, requireActor, requireUser } from "../lib/auth.js";
import { emitEvent } from "../lib/events.js";
import { mintAgentKey } from "../lib/keys.js";

export async function agentRoutes(app: FastifyInstance) {
  app.post("/api/v1/projects/:id/agents/register", { schema: { tags: ["agents"], summary: "Register an agent (key shown once)" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = registerAgentBodySchema.parse(req.body);
    const agent = await prisma.agent.create({
      data: {
        projectId: id,
        name: body.name,
        kind: body.kind ?? "generic",
        description: body.description ?? "",
      },
    });
    const key = await mintAgentKey();
    await prisma.agentKey.create({
      data: { agentId: agent.id, keyHash: key.hash, prefix: key.prefix },
    });
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.agentRegistered,
      payload: { agentId: agent.id, name: agent.name, kind: agent.kind },
      actorType: "user",
      actorUserId: actor.user.id,
      actorAgentId: agent.id,
    });
    return reply.code(201).send({
      agent,
      apiKey: key.raw,
      warning: "Store this key now. ContextOS will not show it again.",
    });
  });

  app.get("/api/v1/projects/:id/agents", { schema: { tags: ["agents"], summary: "List agents" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const agents = await prisma.agent.findMany({
      where: { projectId: id },
      include: { keys: { where: { revokedAt: null }, select: { prefix: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { agents };
  });

  app.post("/api/v1/agents/:id/heartbeat", { schema: { tags: ["agents"], summary: "Agent heartbeat" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "Not Found", message: "Agent not found." });
    const access = await getProjectAccess(actor, agent.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Agent not found." });
    if (actor.kind === "agent" && actor.agent.id !== id) {
      return reply.code(403).send({ error: "Forbidden", message: "An agent may only heartbeat as itself." });
    }
    const body = heartbeatBodySchema.parse(req.body ?? {});
    const updated = await prisma.agent.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        presence: "online",
        activity: body.activity ?? agent.activity,
      },
    });
    await emitEvent(app, {
      projectId: agent.projectId,
      type: EVENT_NAMES.agentHeartbeat,
      payload: { agentId: id, activity: updated.activity },
      actorType: "agent",
      actorAgentId: id,
    });
    return { agent: updated };
  });

  app.patch("/api/v1/agents/:id/presence", { schema: { tags: ["agents"], summary: "Set presence" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "Not Found", message: "Agent not found." });
    const access = await getProjectAccess(actor, agent.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Agent not found." });
    const body = presenceBodySchema.parse(req.body);
    const updated = await prisma.agent.update({
      where: { id },
      data: { presence: body.presence, activity: body.activity ?? agent.activity, lastHeartbeat: new Date() },
    });
    await emitEvent(app, {
      projectId: agent.projectId,
      type: EVENT_NAMES.agentPresence,
      payload: { agentId: id, presence: updated.presence },
      actorType: actor.kind === "agent" ? "agent" : "user",
      actorAgentId: id,
      actorUserId: actor.kind === "user" ? actor.user.id : null,
    });
    return { agent: updated };
  });

  app.post("/api/v1/agents/:id/rotate-key", { schema: { tags: ["agents"], summary: "Rotate API key (shown once)" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "Not Found", message: "Agent not found." });
    const access = await getProjectAccess(actor, agent.projectId);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can rotate keys." });
    }
    await prisma.agentKey.updateMany({ where: { agentId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    const key = await mintAgentKey();
    await prisma.agentKey.create({ data: { agentId: id, keyHash: key.hash, prefix: key.prefix } });
    return { apiKey: key.raw, warning: "Store this key now. ContextOS will not show it again." };
  });

  app.delete("/api/v1/agents/:id", { schema: { tags: ["agents"], summary: "Revoke an agent" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return reply.code(404).send({ error: "Not Found", message: "Agent not found." });
    const access = await getProjectAccess(actor, agent.projectId);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can delete agents." });
    }
    await prisma.agent.delete({ where: { id } });
    await emitEvent(app, {
      projectId: agent.projectId,
      type: EVENT_NAMES.agentRevoked,
      payload: { agentId: id, name: agent.name },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return reply.code(204).send();
  });

  app.get("/api/v1/projects/:id/presence", { schema: { tags: ["agents"], summary: "Presence snapshot" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const agents = await prisma.agent.findMany({
      where: { projectId: id },
      select: { id: true, name: true, kind: true, presence: true, activity: true, lastHeartbeat: true },
    });
    return { agents, now: new Date().toISOString() };
  });

  app.post("/api/v1/projects/:id/handoffs", { schema: { tags: ["agents"], summary: "Create a handoff" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = createHandoffBodySchema.parse(req.body);
    const handoff = await prisma.handoff.create({
      data: {
        projectId: id,
        fromAgentId: body.fromAgentId ?? (actor.kind === "agent" ? actor.agent.id : null),
        toAgentId: body.toAgentId ?? null,
        summary: body.summary,
        details: body.details ?? "",
      },
    });
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.handoffCreated,
      payload: { handoffId: handoff.id, summary: handoff.summary },
      actorType: actor.kind === "agent" ? "agent" : "user",
      actorUserId: isHuman(actor) ? actor.user.id : null,
      actorAgentId: actor.kind === "agent" ? actor.agent.id : null,
    });
    return reply.code(201).send({ handoff });
  });

  app.get("/api/v1/projects/:id/handoffs", { schema: { tags: ["agents"], summary: "List handoffs" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const handoffs = await prisma.handoff.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { handoffs };
  });
}
