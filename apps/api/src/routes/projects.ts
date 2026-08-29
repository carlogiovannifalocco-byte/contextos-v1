import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import {
  contextPackageQuerySchema,
  createProjectBodySchema,
  EVENT_NAMES,
  ignoreRulesBodySchema,
  inviteMemberBodySchema,
  patchMemberRoleBodySchema,
  patchProjectBodySchema,
} from "@contextos/shared";
import { getProjectAccess, isOwnerRole, requireActor, requireUser, denyUnlessWriter } from "../lib/auth.js";
import { emitEvent } from "../lib/events.js";
import { compileContext } from "../services/context.js";
import { slugify } from "../lib/text.js";

export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects", { schema: { tags: ["projects"], summary: "List projects you own or joined" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const rows = await prisma.project.findMany({
      where: {
        OR: [{ ownerId: actor.user.id }, { members: { some: { userId: actor.user.id } } }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { memories: true, tasks: true, agents: true, conflicts: true } },
        members: { where: { userId: actor.user.id }, select: { role: true } },
      },
    });
    return {
      projects: rows.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        rootPath: project.rootPath,
        _count: project._count,
        role: project.ownerId === actor.user.id ? "owner" : (project.members[0]?.role ?? "member"),
      })),
    };
  });

  app.post("/api/v1/projects", { schema: { tags: ["projects"], summary: "Create a project" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const body = createProjectBodySchema.parse(req.body);
    const base = slugify(body.name);
    let slug = base;
    let n = 1;
    while (await prisma.project.findUnique({ where: { ownerId_slug: { ownerId: actor.user.id, slug } } })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    const project = await prisma.project.create({
      data: {
        ownerId: actor.user.id,
        name: body.name,
        slug,
        description: body.description ?? "",
        rootPath: body.rootPath,
        ignoreRules: { create: {} },
      },
    });
    await emitEvent(app, {
      projectId: project.id,
      type: EVENT_NAMES.projectUpdated,
      payload: { created: true, name: project.name },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return reply.code(201).send({ project });
  });

  app.get("/api/v1/projects/:id", { schema: { tags: ["projects"], summary: "Get a project" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: { select: { memories: true, tasks: true, agents: true, conflicts: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    return { project, role: access.role };
  });

  app.patch("/api/v1/projects/:id", { schema: { tags: ["projects"], summary: "Update a project" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (!isOwnerRole(access.role)) return reply.code(403).send({ error: "Forbidden", message: "Only the owner can edit project settings." });
    const body = patchProjectBodySchema.parse(req.body);
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        rootPath: body.rootPath === undefined ? undefined : body.rootPath,
      },
    });
    return { project };
  });

  app.delete("/api/v1/projects/:id", { schema: { tags: ["projects"], summary: "Delete a project" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (!isOwnerRole(access.role)) return reply.code(403).send({ error: "Forbidden", message: "Only the owner can delete a project." });
    await prisma.project.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post("/api/v1/projects/:id/import", { schema: { tags: ["projects"], summary: "Import a project snapshot JSON" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can import." });
    }
    const body = req.body as { memories?: Array<{ type: string; title: string; body: string; tags?: string[] }> };
    const memories = Array.isArray(body.memories) ? body.memories.slice(0, 200) : [];
    let imported = 0;
    for (const m of memories) {
      if (!m?.title || !m?.body || !m?.type) continue;
      const entry = await prisma.memoryEntry.create({
        data: {
          projectId: id,
          type: m.type as "note",
          title: String(m.title).slice(0, 200),
          body: String(m.body).slice(0, 20_000),
          tags: Array.isArray(m.tags) ? m.tags.map(String).slice(0, 16) : [],
          createdByType: "user",
          createdByUserId: actor.user.id,
        },
      });
      await prisma.memoryVersion.create({
        data: {
          memoryId: entry.id,
          version: 1,
          type: entry.type,
          title: entry.title,
          body: entry.body,
          tags: entry.tags,
          createdByType: "user",
          createdByUserId: actor.user.id,
        },
      });
      imported += 1;
    }
    return { imported };
  });

  app.get("/api/v1/projects/:id/export", { schema: { tags: ["projects"], summary: "Export project JSON" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        memories: true,
        tasks: true,
        agents: { select: { id: true, name: true, kind: true, presence: true, activity: true, createdAt: true } },
        conflicts: true,
        handoffs: true,
        ignoreRules: true,
      },
    });
    return { exportedAt: new Date().toISOString(), project };
  });

  app.get("/api/v1/projects/:id/context-package", {
    schema: {
      tags: ["projects"],
      summary: "Compiled context brief for agents",
      description:
        "Ranks shared memory by priority and relevance, drops superseded entries, and packs the result into a token budget. Use format=md to get a brief you can paste straight into a prompt.",
      querystring: {
        type: "object",
        properties: {
          budget: { type: "integer", minimum: 200, maximum: 32000, default: 2000, example: 2000 },
          focus: { type: "string", example: "ignore file syntax" },
          format: { type: "string", enum: ["json", "md"], default: "json" },
        },
      },
    },
  }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const query = contextPackageQuerySchema.parse(req.query);
    const [memories, relations, tasks, conflicts, handoffs, agents] = await Promise.all([
      prisma.memoryEntry.findMany({
        where: { projectId: id, status: "active" },
        orderBy: [{ pinned: "desc" }, { verified: "desc" }, { updatedAt: "desc" }],
        take: 300,
      }),
      prisma.memoryRelation.findMany({ where: { projectId: id } }),
      prisma.task.findMany({ where: { projectId: id, status: { not: "done" } }, take: 40 }),
      prisma.conflict.findMany({ where: { projectId: id, status: "open" }, take: 20 }),
      prisma.handoff.findMany({ where: { projectId: id, status: "open" }, take: 20 }),
      prisma.agent.findMany({
        where: { projectId: id },
        select: { id: true, name: true, kind: true, presence: true, activity: true, lastHeartbeat: true },
      }),
    ]);

    const compiled = compileContext({
      project: { id: access.project.id, name: access.project.name, description: access.project.description },
      memories,
      relations,
      openTasks: tasks,
      openConflicts: conflicts,
      openHandoffs: handoffs,
      agents,
      focus: query.focus,
      budgetTokens: query.budget,
    });

    if (query.format === "md") {
      return reply.type("text/markdown; charset=utf-8").send(compiled.markdown);
    }

    // `memories` is kept as a flat list for clients written against the pre-compiler shape.
    return {
      ...compiled,
      memories: compiled.included.map((entry) => entry.memory),
    };
  });

  app.get("/api/v1/projects/:id/ignore-rules", { schema: { tags: ["projects"], summary: "Read .contextosignore" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const rules = await prisma.ignoreRules.upsert({
      where: { projectId: id },
      update: {},
      create: { projectId: id },
    });
    return { content: rules.content, updatedAt: rules.updatedAt.toISOString() };
  });

  app.put("/api/v1/projects/:id/ignore-rules", { schema: { tags: ["projects"], summary: "Write .contextosignore" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = ignoreRulesBodySchema.parse(req.body);
    const rules = await prisma.ignoreRules.upsert({
      where: { projectId: id },
      update: { content: body.content },
      create: { projectId: id, content: body.content },
    });
    return { content: rules.content, updatedAt: rules.updatedAt.toISOString() };
  });

  app.get("/api/v1/projects/:id/members", { schema: { tags: ["projects"], summary: "List project team" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!project) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const team = [
      {
        userId: project.owner.id,
        name: project.owner.name,
        email: project.owner.email,
        role: "owner" as const,
        joinedAt: project.createdAt.toISOString(),
      },
      ...project.members.map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        memberId: member.id,
        joinedAt: member.createdAt.toISOString(),
      })),
    ];
    const pending =
      isOwnerRole(access.role) ?
        await prisma.projectInvite.findMany({
          where: { projectId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, createdAt: true },
        })
      : [];
    return {
      members: team,
      pending: pending.map((row) => ({
        inviteId: row.id,
        email: row.email,
        role: row.role,
        invitedAt: row.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/v1/projects/:id/members", { schema: { tags: ["projects"], summary: "Invite a teammate by email" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (!isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can invite teammates." });
    }
    const body = inviteMemberBodySchema.parse(req.body);
    const inviteRole = body.role ?? "member";
    const invitee = await prisma.user.findUnique({ where: { email: body.email } });
    if (!invitee) {
      const dup = await prisma.projectInvite.findUnique({
        where: { projectId_email: { projectId: id, email: body.email } },
      });
      if (dup) {
        return reply.code(409).send({ error: "Conflict", message: "That email already has a pending invite." });
      }
      const pending = await prisma.projectInvite.create({
        data: { projectId: id, email: body.email, role: inviteRole, invitedBy: actor.user.id },
      });
      await emitEvent(app, {
        projectId: id,
        type: EVENT_NAMES.projectUpdated,
        payload: { invitedPending: pending.email },
        actorType: "user",
        actorUserId: actor.user.id,
      });
      return reply.code(202).send({
        pending: {
          inviteId: pending.id,
          email: pending.email,
          role: pending.role,
          invitedAt: pending.createdAt.toISOString(),
        },
        message: "Invite saved. They will join automatically when they register with this email.",
      });
    }
    if (invitee.id === actor.user.id) {
      return reply.code(400).send({ error: "Bad Request", message: "You already own this project." });
    }
    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (project?.ownerId === invitee.id) {
      return reply.code(400).send({ error: "Bad Request", message: "That user already owns this project." });
    }
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: invitee.id } },
    });
    if (existing) {
      return reply.code(409).send({ error: "Conflict", message: "That user is already on the team." });
    }
    await prisma.projectInvite.deleteMany({ where: { projectId: id, email: body.email } });
    const member = await prisma.projectMember.create({
      data: { projectId: id, userId: invitee.id, role: inviteRole },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.projectUpdated,
      payload: { invited: member.user.email, role: member.role },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return reply.code(201).send({
      member: {
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        memberId: member.id,
        joinedAt: member.createdAt.toISOString(),
      },
    });
  });

  app.patch("/api/v1/projects/:id/members/:userId", { schema: { tags: ["projects"], summary: "Change a teammate role" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id, userId } = req.params as { id: string; userId: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (!isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can change roles." });
    }
    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (project?.ownerId === userId) {
      return reply.code(400).send({ error: "Bad Request", message: "The owner role cannot be changed." });
    }
    const body = patchMemberRoleBodySchema.parse(req.body);
    const updated = await prisma.projectMember.updateMany({
      where: { projectId: id, userId },
      data: { role: body.role },
    });
    if (updated.count === 0) {
      return reply.code(404).send({ error: "Not Found", message: "That user is not on the team." });
    }
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!member) return reply.code(404).send({ error: "Not Found", message: "That user is not on the team." });
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.projectUpdated,
      payload: { roleChanged: member.user.email, role: body.role },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return {
      member: {
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        memberId: member.id,
        joinedAt: member.createdAt.toISOString(),
      },
    };
  });

  app.delete("/api/v1/projects/:id/members/:userId", { schema: { tags: ["projects"], summary: "Remove a teammate" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id, userId } = req.params as { id: string; userId: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (!isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can remove teammates." });
    }
    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (project?.ownerId === userId) {
      return reply.code(400).send({ error: "Bad Request", message: "The owner cannot be removed." });
    }
    const deleted = await prisma.projectMember.deleteMany({ where: { projectId: id, userId } });
    if (deleted.count === 0) {
      return reply.code(404).send({ error: "Not Found", message: "That user is not on the team." });
    }
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.projectUpdated,
      payload: { removed: userId },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return reply.code(204).send();
  });

  app.delete("/api/v1/projects/:id/invites/:inviteId", { schema: { tags: ["projects"], summary: "Revoke a pending invite" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id, inviteId } = req.params as { id: string; inviteId: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (!isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can revoke invites." });
    }
    const deleted = await prisma.projectInvite.deleteMany({ where: { id: inviteId, projectId: id } });
    if (deleted.count === 0) {
      return reply.code(404).send({ error: "Not Found", message: "Pending invite not found." });
    }
    return reply.code(204).send();
  });
}
