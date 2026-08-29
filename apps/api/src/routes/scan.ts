import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { scanBodySchema } from "@contextos/shared";
import { denyUnlessWriter, getProjectAccess, requireActor, requireUser } from "../lib/auth.js";
import { runScanJob } from "../services/scan.js";

export async function scanRoutes(app: FastifyInstance) {
  app.post("/api/v1/projects/:id/scan", {
    schema: {
      tags: ["scan"],
      summary: "Start a folder scan (proposals only)",
      description:
        "Walks the folder with .contextosignore. Heuristic proposals (package.json, README, EditorConfig) stay pending until a human activates them.",
      body: {
        type: "object",
        properties: {
          rootPath: { type: "string", example: "fixtures/atlas-cli" },
        },
      },
    },
  }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = scanBodySchema.parse(req.body ?? {});
    const rootPath = body.rootPath ?? access.project.rootPath;
    if (!rootPath) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Set a project root path or pass rootPath in the scan request.",
      });
    }
    const job = await prisma.scanJob.create({
      data: { projectId: id, rootPath, status: "queued" },
    });
    void runScanJob(app, job.id);
    return reply.code(202).send({ job });
  });

  app.get("/api/v1/scan-jobs/:id", { schema: { tags: ["scan"], summary: "Scan job status" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const job = await prisma.scanJob.findUnique({
      where: { id },
      include: { proposals: true },
    });
    if (!job) return reply.code(404).send({ error: "Not Found", message: "Scan job not found." });
    const access = await getProjectAccess(actor, job.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Scan job not found." });
    return { job };
  });

  app.post("/api/v1/scan-jobs/:id/cancel", { schema: { tags: ["scan"], summary: "Cancel a running scan" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const job = await prisma.scanJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Not Found", message: "Scan job not found." });
    const access = await getProjectAccess(actor, job.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Scan job not found." });
    if (denyUnlessWriter(reply, access)) return;
    const updated = await prisma.scanJob.update({
      where: { id },
      data: {
        cancelled: true,
        status: job.status === "completed" || job.status === "failed" ? job.status : "cancelled",
        finishedAt: job.finishedAt ?? new Date(),
      },
    });
    return { job: updated };
  });

  app.post("/api/v1/scan-jobs/:id/activate", { schema: { tags: ["scan"], summary: "Promote approved proposals to memory" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const job = await prisma.scanJob.findUnique({
      where: { id },
      include: { proposals: true },
    });
    if (!job) return reply.code(404).send({ error: "Not Found", message: "Scan job not found." });
    const access = await getProjectAccess(actor, job.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Scan job not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = (req.body ?? {}) as { proposalIds?: string[] };
    const selected = body.proposalIds?.length
      ? job.proposals.filter((p) => body.proposalIds?.includes(p.id) && p.status === "pending")
      : job.proposals.filter((p) => p.status === "pending");
    const created = [];
    for (const proposal of selected) {
      const entry = await prisma.memoryEntry.create({
        data: {
          projectId: job.projectId,
          type: proposal.type,
          title: proposal.title,
          body: `${proposal.body}\n\nSource: ${proposal.sourcePath}`,
          tags: ["scan"],
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
      await prisma.scanProposal.update({ where: { id: proposal.id }, data: { status: "accepted" } });
      created.push(entry);
    }
    return { activated: created.length, memories: created };
  });
}
