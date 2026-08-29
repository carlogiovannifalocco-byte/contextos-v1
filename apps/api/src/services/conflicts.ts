import { prisma } from "@contextos/db";
import { EVENT_NAMES } from "@contextos/shared";
import type { MemoryType } from "@contextos/db";
import type { FastifyInstance } from "fastify";
import { emitEvent } from "../lib/events.js";
import { similarTitles } from "../lib/text.js";

export async function detectConflictsForEntry(
  app: FastifyInstance,
  entry: {
    id: string;
    projectId: string;
    type: MemoryType;
    title: string;
    body: string;
    status: string;
  },
) {
  if (entry.status !== "active") return [];
  if (entry.type !== "decision" && entry.type !== "convention" && entry.type !== "constraint") {
    return [];
  }
  const others = await prisma.memoryEntry.findMany({
    where: {
      projectId: entry.projectId,
      status: "active",
      type: entry.type,
      id: { not: entry.id },
    },
  });
  const created = [];
  for (const other of others) {
    if (!similarTitles(entry.title, other.title)) continue;
    const existing = await prisma.conflict.findFirst({
      where: {
        projectId: entry.projectId,
        status: "open",
        OR: [
          { memoryAId: entry.id, memoryBId: other.id },
          { memoryAId: other.id, memoryBId: entry.id },
        ],
      },
    });
    if (existing) continue;
    const conflict = await prisma.conflict.create({
      data: {
        projectId: entry.projectId,
        memoryAId: other.id,
        memoryBId: entry.id,
        reason: `Two ${entry.type} entries share a similar title and may contradict each other.`,
      },
    });
    await emitEvent(app, {
      projectId: entry.projectId,
      type: EVENT_NAMES.conflictDetected,
      payload: { conflictId: conflict.id, title: entry.title },
    });
    created.push(conflict);
  }
  return created;
}

export async function detectAll(app: FastifyInstance, projectId: string) {
  const entries = await prisma.memoryEntry.findMany({
    where: { projectId, status: "active" },
  });
  const found = [];
  for (const entry of entries) {
    found.push(...(await detectConflictsForEntry(app, entry)));
  }
  return found;
}
