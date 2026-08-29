import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { getProjectAccess, isOwnerRole, requireActor, requireUser } from "../lib/auth.js";
import { hub } from "../lib/realtime.js";

export async function eventRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:id/events", { schema: { tags: ["events"], summary: "Project event timeline" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const q = req.query as { limit?: string };
    const events = await prisma.event.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(q.limit ?? 80) || 80, 200),
    });
    return { events };
  });

  app.delete("/api/v1/projects/:id/events", { schema: { tags: ["events"], summary: "Purge events (owner)" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can purge events." });
    }
    const result = await prisma.event.deleteMany({ where: { projectId: id } });
    return { deleted: result.count };
  });

  app.get("/api/v1/projects/:id/stream", { schema: { tags: ["events"], summary: "Server-sent events for a project" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ projectId: id })}\n\n`);
    const unsub = hub.subscribeSse(id, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const ping = setInterval(() => {
      reply.raw.write(`event: ping\ndata: {}\n\n`);
    }, 25000);
    req.raw.on("close", () => {
      clearInterval(ping);
      unsub();
    });
  });
}

export async function websocketRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      socket.close();
      return;
    }
    const { resolveActor, getProjectAccess } = await import("../lib/auth.js");
    (req as typeof req & { actor: null }).actor = null;
    const actor = await resolveActor(req);
    if (!actor) {
      socket.close();
      return;
    }
    const access = await getProjectAccess(actor, projectId);
    if (!access) {
      socket.close();
      return;
    }
    const unsub = hub.subscribeWs(projectId, {
      send: (payload) => socket.send(payload),
    });
    socket.send(JSON.stringify({ type: "ready", projectId }));
    socket.on("close", unsub);
  });
}
