import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { EVENT_NAMES, mergeConflictBodySchema, resolveConflictBodySchema } from "@contextos/shared";
import { denyUnlessWriter, getProjectAccess, requireActor, requireUser } from "../lib/auth.js";
import { emitEvent } from "../lib/events.js";
import { detectAll } from "../services/conflicts.js";

export async function conflictRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:id/conflicts", { schema: { tags: ["conflicts"], summary: "List conflicts" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const conflicts = await prisma.conflict.findMany({
      where: { projectId: id },
      include: { memoryA: true, memoryB: true },
      orderBy: { createdAt: "desc" },
    });
    return { conflicts };
  });

  app.post("/api/v1/projects/:id/conflicts/detect", { schema: { tags: ["conflicts"], summary: "Re-run lexical conflict detection" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const created = await detectAll(app, id);
    return { created: created.length, conflicts: created };
  });

  app.post("/api/v1/conflicts/:id/merge", { schema: { tags: ["conflicts"], summary: "Merge two memories into one (human)" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const conflict = await prisma.conflict.findUnique({
      where: { id },
      include: { memoryA: true, memoryB: true },
    });
    if (!conflict) return reply.code(404).send({ error: "Not Found", message: "Conflict not found." });
    const access = await getProjectAccess(actor, conflict.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Conflict not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = mergeConflictBodySchema.parse(req.body);
    const merged = await prisma.memoryEntry.update({
      where: { id: conflict.memoryAId },
      data: {
        title: body.title,
        body: body.body,
        currentVersion: conflict.memoryA.currentVersion + 1,
        verified: true,
        verifiedAt: new Date(),
        verifiedById: actor.user.id,
      },
    });
    await prisma.memoryVersion.create({
      data: {
        memoryId: merged.id,
        version: merged.currentVersion,
        type: merged.type,
        title: merged.title,
        body: merged.body,
        tags: merged.tags,
        createdByType: "user",
        createdByUserId: actor.user.id,
      },
    });
    await prisma.memoryEntry.update({
      where: { id: conflict.memoryBId },
      data: { status: "archived" },
    });
    const updated = await prisma.conflict.update({
      where: { id },
      data: {
        status: "merged",
        resolution: "Merged by human into a single verified memory.",
        mergedTitle: body.title,
        mergedBody: body.body,
        resolvedAt: new Date(),
      },
    });
    await emitEvent(app, {
      projectId: conflict.projectId,
      type: EVENT_NAMES.conflictMerged,
      payload: { conflictId: id, memoryId: merged.id },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return { conflict: updated, memory: merged };
  });

  app.post("/api/v1/conflicts/:id/resolve", { schema: { tags: ["conflicts"], summary: "Pick a winner (human)" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const conflict = await prisma.conflict.findUnique({ where: { id } });
    if (!conflict) return reply.code(404).send({ error: "Not Found", message: "Conflict not found." });
    const access = await getProjectAccess(actor, conflict.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Conflict not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = resolveConflictBodySchema.parse(req.body);
    if (body.winnerId !== conflict.memoryAId && body.winnerId !== conflict.memoryBId) {
      return reply.code(400).send({ error: "Bad Request", message: "winnerId must be one of the conflicting memories." });
    }
    const loserId = body.winnerId === conflict.memoryAId ? conflict.memoryBId : conflict.memoryAId;
    await prisma.memoryEntry.update({
      where: { id: body.winnerId },
      data: { verified: true, verifiedAt: new Date(), verifiedById: actor.user.id },
    });
    await prisma.memoryEntry.update({
      where: { id: loserId },
      data: { status: "archived" },
    });
    const updated = await prisma.conflict.update({
      where: { id },
      data: { status: "resolved", resolution: body.resolution, resolvedAt: new Date() },
    });
    await emitEvent(app, {
      projectId: conflict.projectId,
      type: EVENT_NAMES.conflictResolved,
      payload: { conflictId: id, winnerId: body.winnerId },
      actorType: "user",
      actorUserId: actor.user.id,
    });
    return { conflict: updated };
  });
}
