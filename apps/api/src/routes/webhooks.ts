import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { createWebhookBodySchema, patchWebhookBodySchema } from "@contextos/shared";
import { getProjectAccess, isOwnerRole, requireUser } from "../lib/auth.js";
import { mintWebhookSecret } from "../services/webhooks.js";

export async function webhookRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:id/webhooks", { schema: { tags: ["webhooks"], summary: "List webhooks" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can manage webhooks." });
    }
    const webhooks = await prisma.webhook.findMany({
      where: { projectId: id },
      select: {
        id: true,
        url: true,
        events: true,
        enabled: true,
        lastFiredAt: true,
        lastStatus: true,
        createdAt: true,
      },
    });
    return { webhooks };
  });

  app.post("/api/v1/projects/:id/webhooks", { schema: { tags: ["webhooks"], summary: "Create webhook (secret shown once)" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const access = await getProjectAccess(actor, id);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can manage webhooks." });
    }
    const body = createWebhookBodySchema.parse(req.body);
    const secret = mintWebhookSecret();
    const webhook = await prisma.webhook.create({
      data: {
        projectId: id,
        url: body.url,
        events: body.events ?? ["*"],
        secret,
      },
    });
    return reply.code(201).send({
      webhook: { ...webhook, secret: undefined },
      secret,
      warning: "Store this secret now. ContextOS will not show it again.",
    });
  });

  app.patch("/api/v1/webhooks/:id", { schema: { tags: ["webhooks"], summary: "Update webhook" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const hook = await prisma.webhook.findUnique({ where: { id } });
    if (!hook) return reply.code(404).send({ error: "Not Found", message: "Webhook not found." });
    const access = await getProjectAccess(actor, hook.projectId);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can manage webhooks." });
    }
    const body = patchWebhookBodySchema.parse(req.body);
    const webhook = await prisma.webhook.update({
      where: { id },
      data: { url: body.url, events: body.events, enabled: body.enabled },
      select: {
        id: true,
        url: true,
        events: true,
        enabled: true,
        lastFiredAt: true,
        lastStatus: true,
        createdAt: true,
      },
    });
    return { webhook };
  });

  app.delete("/api/v1/webhooks/:id", { schema: { tags: ["webhooks"], summary: "Delete webhook" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const { id } = req.params as { id: string };
    const hook = await prisma.webhook.findUnique({ where: { id } });
    if (!hook) return reply.code(404).send({ error: "Not Found", message: "Webhook not found." });
    const access = await getProjectAccess(actor, hook.projectId);
    if (!access || !isOwnerRole(access.role)) {
      return reply.code(403).send({ error: "Forbidden", message: "Only the owner can manage webhooks." });
    }
    await prisma.webhook.delete({ where: { id } });
    return reply.code(204).send();
  });
}
