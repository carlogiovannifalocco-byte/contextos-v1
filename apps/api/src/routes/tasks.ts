import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { createTaskBodySchema, EVENT_NAMES, patchTaskBodySchema } from "@contextos/shared";
import { denyUnlessWriter, getProjectAccess, requireActor } from "../lib/auth.js";
import { emitEvent } from "../lib/events.js";

export async function taskRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:id/tasks", { schema: { tags: ["tasks"], summary: "List tasks" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: "desc" },
    });
    return { tasks };
  });

  app.post("/api/v1/projects/:id/tasks", { schema: { tags: ["tasks"], summary: "Create a task" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Project not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = createTaskBodySchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        projectId: id,
        title: body.title,
        description: body.description ?? "",
        status: body.status ?? "open",
        assigneeAgentId: body.assigneeAgentId ?? null,
        createdByType: actor.kind === "user" ? "user" : "agent",
        createdByUserId: actor.kind === "user" ? actor.user.id : null,
        createdByAgentId: actor.kind === "agent" ? actor.agent.id : null,
      },
    });
    await emitEvent(app, {
      projectId: id,
      type: EVENT_NAMES.taskCreated,
      payload: { taskId: task.id, title: task.title },
      actorType: task.createdByType,
      actorUserId: task.createdByUserId,
      actorAgentId: task.createdByAgentId,
    });
    return reply.code(201).send({ task });
  });

  app.patch("/api/v1/tasks/:id", { schema: { tags: ["tasks"], summary: "Update a task" } }, async (req, reply) => {
    const actor = await requireActor(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Not Found", message: "Task not found." });
    const access = await getProjectAccess(actor, existing.projectId);
    if (!access) return reply.code(404).send({ error: "Not Found", message: "Task not found." });
    if (denyUnlessWriter(reply, access)) return;
    const body = patchTaskBodySchema.parse(req.body);
    const task = await prisma.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        assigneeAgentId: body.assigneeAgentId === undefined ? undefined : body.assigneeAgentId,
      },
    });
    await emitEvent(app, {
      projectId: existing.projectId,
      type: EVENT_NAMES.taskUpdated,
      payload: { taskId: task.id, status: task.status },
      actorType: actor.kind === "user" ? "user" : "agent",
      actorUserId: actor.kind === "user" ? actor.user.id : null,
      actorAgentId: actor.kind === "agent" ? actor.agent.id : null,
    });
    return { task };
  });
}
