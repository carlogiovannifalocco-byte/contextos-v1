import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import {
  createMemoryBodySchema,
  createMemoryRelationBodySchema,
  EVENT_NAMES,
  importMemoryBodySchema,
  paginationQuerySchema,
  patchMemoryBodySchema,
} from "@contextos/shared";
import { getProjectAccess, isHuman, requireActor, denyUnlessWriter } from "../lib/auth.js";
import { emitEvent } from "../lib/events.js";
import { bm25 } from "../lib/rank.js";
import { detectConflictsForEntry } from "../services/conflicts.js";

function actorMeta(actor: NonNullable<Awaited<ReturnType<typeof requireActor>>>) {
  if (actor.kind === "user") {
    return { createdByType: "user" as const, createdByUserId: actor.user.id, createdByAgentId: null };
  }
  return { createdByType: "agent" as const, createdByUserId: null, createdByAgentId: actor.agent.id };
}

export async function memoryRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:id/memory", { schema: { tags: ["memory"], summary: "List memory" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const q = paginationQuerySchema.parse(req.query);
    const memories = await prisma.memoryEntry.findMany({
      where: {
        projectId: id,
        type: q.type,
        status: q.status ?? { not: "archived" },
        verified: q.verified === undefined ? undefined : q.verified === "true",
        pinned: q.pinned === undefined ? undefined : q.pinned === "true",
        ...(q.q
          ? {
              OR: [
                { title: { contains: q.q, mode: "insensitive" } },
                { body: { contains: q.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: q.q ? 200 : (q.limit ?? 50),
    });

    if (!q.q) return { memories };

    // A substring filter cannot tell a title match from a passing mention, so
    // matching rows are re-ordered by relevance before the limit is applied.
    const scores = bm25(
      memories.map((m) => ({ id: m.id, title: m.title, body: m.body, tags: m.tags })),
      q.q,
    );
    const ranked = [...memories].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return { memories: ranked.slice(0, q.limit ?? 50) };
  });

  app.post("/api/v1/projects/:id/memory", {
    schema: {
      tags: ["memory"],
      summary: "Write memory",
      description: "Creates a versioned entry. Agents cannot mark verified. Lexical conflict detection runs after write.",
      body: {
        type: "object",
        required: ["type", "title", "body"],
        properties: {
          type: { type: "string", example: "decision" },
          title: { type: "string", example: "Auth uses sessions" },
          body: { type: "string", example: "HttpOnly cookies, not JWT in localStorage." },
        },
      },
    },
  }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = createMemoryBodySchema.parse(req.body);
    const meta = actorMeta(actor);
    const entry = await prisma.memoryEntry.create({
      data: {
        projectId: id,
        type: body.type,
        title: body.title,
        body: body.body,
        tags: body.tags ?? [],
        status: body.status ?? "active",
        pinned: body.pinned ?? false,
        ...meta,
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
        ...meta,
      },
    });
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.memoryCreated,
      payload: { memoryId: entry.id, title: entry.title, type: entry.type },
      actorType: meta.createdByType,
      actorUserId: meta.createdByUserId,
      actorAgentId: meta.createdByAgentId,
    });
    const conflicts = await detectConflictsForEntry(app, entry);
    return reply.code(201).send({ memory: entry, conflicts });
  });

  app.post("/api/v1/projects/:id/memory/import", { schema: { tags: ["memory"], summary: "Bulk import memory" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = importMemoryBodySchema.parse(req.body);
    const meta = actorMeta(actor);
    const created = [];
    for (const item of body.entries) {
      const entry = await prisma.memoryEntry.create({
        data: {
          projectId: id,
          type: item.type,
          title: item.title,
          body: item.body,
          tags: item.tags ?? [],
          status: item.status ?? "active",
          pinned: item.pinned ?? false,
          ...meta,
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
          ...meta,
        },
      });
      created.push(entry);
    }
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.memoryCreated,
      payload: { imported: created.length },
      actorType: meta.createdByType,
      actorUserId: meta.createdByUserId,
      actorAgentId: meta.createdByAgentId,
    });
    return { imported: created.length };
  });

  app.get("/api/v1/memory/:id", { schema: { tags: ["memory"], summary: "Get one memory entry" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const memory = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!memory) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const access = await getProjectAccess(actor, memory.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    return { memory };
  });

  app.patch("/api/v1/memory/:id", { schema: { tags: ["memory"], summary: "Update memory (creates a version)" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const memory = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!memory) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const access = await getProjectAccess(actor, memory.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = patchMemoryBodySchema.parse(req.body);
    if (body.verified !== undefined && !isHuman(actor)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only a human can verify memory." });
    }
    const meta = actorMeta(actor);
    const nextVersion = memory.currentVersion + (body.title || body.body || body.type || body.tags ? 1 : 0);
    const updated = await prisma.memoryEntry.update({
      where: { id },
      data: {
        type: body.type,
        title: body.title,
        body: body.body,
        tags: body.tags,
        status: body.status,
        pinned: body.pinned,
        verified: body.verified,
        verifiedAt: body.verified ? new Date() : body.verified === false ? null : undefined,
        verifiedById: body.verified && isHuman(actor) ? actor.user.id : body.verified === false ? null : undefined,
        currentVersion: body.title || body.body || body.type || body.tags ? nextVersion : undefined,
      },
    });
    if (body.title || body.body || body.type || body.tags) {
      await prisma.memoryVersion.create({
        data: {
          memoryId: id,
          version: nextVersion,
          type: updated.type,
          title: updated.title,
          body: updated.body,
          tags: updated.tags,
          ...meta,
        },
      });
    }
    await emitEvent(app, {
      projectId: memory.projectId,
      type: body.verified ? EVENT_NAMES.memoryVerified : EVENT_NAMES.memoryUpdated,
      payload: { memoryId: id, title: updated.title },
      actorType: meta.createdByType,
      actorUserId: meta.createdByUserId,
      actorAgentId: meta.createdByAgentId,
    });
    if (body.title) await detectConflictsForEntry(app, updated);
    return { memory: updated };
  });

  app.delete("/api/v1/memory/:id", { schema: { tags: ["memory"], summary: "Archive-delete memory" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const memory = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!memory) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const access = await getProjectAccess(actor, memory.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    if (denyUnlessWriter(reply, access)) return;
    await prisma.memoryEntry.delete({ where: { id } });
    await emitEvent(app, {
      projectId: memory.projectId,
      type: EVENT_NAMES.memoryDeleted,
      payload: { memoryId: id, title: memory.title },
      actorType: actor.kind === "user" ? "user" : "agent",
      actorUserId: actor.kind === "user" ? actor.user.id : null,
      actorAgentId: actor.kind === "agent" ? actor.agent.id : null,
    });
    return reply.code(204).send();
  });

  app.get("/api/v1/memory/:id/relations", { schema: { tags: ["memory"], summary: "Links in and out of this entry" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const memory = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!memory) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const access = await getProjectAccess(actor, memory.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const select = { id: true, title: true, type: true, status: true };
    const [outgoing, incoming] = await Promise.all([
      prisma.memoryRelation.findMany({
        where: { fromId: id },
        include: { to: { select } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.memoryRelation.findMany({
        where: { toId: id },
        include: { from: { select } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { outgoing, incoming };
  });

  app.post("/api/v1/memory/:id/relations", {
    schema: {
      tags: ["memory"],
      summary: "Link two memory entries",
      description:
        "Kinds: supersedes, contradicts, references, parent_of. A supersedes link removes the target from future context briefs.",
      body: {
        type: "object",
        required: ["toId", "kind"],
        properties: {
          toId: { type: "string", example: "clz1memoryid0000000000000" },
          kind: { type: "string", enum: ["supersedes", "contradicts", "references", "parent_of"], example: "supersedes" },
          note: { type: "string", example: "Replaced after the team moved to gitignore syntax." },
        },
      },
    },
  }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const body = createMemoryRelationBodySchema.parse(req.body);
    if (body.toId === id) {
      return reply.code(400).send({ error: "Bad Request", message: "A memory entry cannot link to itself." });
    }
    const [from, to] = await Promise.all([
      prisma.memoryEntry.findUnique({ where: { id } }),
      prisma.memoryEntry.findUnique({ where: { id: body.toId } }),
    ]);
    if (!from || !to) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    if (from.projectId !== to.projectId) {
      return reply.code(400).send({ error: "Bad Request", message: "Both entries must belong to the same project." });
    }
    const access = await getProjectAccess(actor, from.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    if (denyUnlessWriter(reply, access)) return;

    const relation = await prisma.memoryRelation.upsert({
      where: { fromId_toId_kind: { fromId: id, toId: body.toId, kind: body.kind } },
      update: { note: body.note ?? "" },
      create: { projectId: from.projectId, fromId: id, toId: body.toId, kind: body.kind, note: body.note ?? "" },
    });

    // Superseding is the one link that changes what agents read, so the old entry
    // is archived in the same step instead of lingering as active memory.
    if (body.kind === "supersedes" && to.status !== "archived") {
      await prisma.memoryEntry.update({ where: { id: to.id }, data: { status: "archived" } });
    }

    const meta = actorMeta(actor);
    await emitEvent(app, {
      projectId: from.projectId,
      type: body.kind === "supersedes" ? EVENT_NAMES.memorySuperseded : EVENT_NAMES.memoryLinked,
      payload: { fromId: id, toId: body.toId, kind: body.kind },
      actorType: meta.createdByType,
      actorUserId: meta.createdByUserId,
      actorAgentId: meta.createdByAgentId,
    });
    return reply.code(201).send({ relation });
  });

  app.delete("/api/v1/memory/:id/relations/:relationId", { schema: { tags: ["memory"], summary: "Remove a link" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id, relationId } = req.params as { id: string; relationId: string };
    const relation = await prisma.memoryRelation.findUnique({ where: { id: relationId } });
    if (!relation || relation.fromId !== id) {
      return reply.code(404).send({ error: "Not Found", message: "Relation not found." });
    }
    const access = await getProjectAccess(actor, relation.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Relation not found." });
    if (denyUnlessWriter(reply, access)) return;
    await prisma.memoryRelation.delete({ where: { id: relationId } });
    return reply.code(204).send();
  });

  app.get("/api/v1/memory/:id/versions", { schema: { tags: ["memory"], summary: "Version history" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const memory = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!memory) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const access = await getProjectAccess(actor, memory.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Memory not found." });
    const versions = await prisma.memoryVersion.findMany({
      where: { memoryId: id },
      orderBy: { version: "desc" },
    });
    return { versions };
  });
}
