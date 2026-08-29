import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { EVENT_NAMES } from "@contextos/shared";
import { emitEvent } from "../lib/events.js";

export async function dispatchWebhooks(
  app: FastifyInstance,
  projectId: string,
  event: { type: string; payload: unknown },
) {
  const hooks = await prisma.webhook.findMany({
    where: { projectId, enabled: true },
  });
  for (const hook of hooks) {
    if (hook.events.length > 0 && !hook.events.includes(event.type) && !hook.events.includes("*")) {
      continue;
    }
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-contextos-secret": hook.secret,
          "x-contextos-event": event.type,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(4000),
      });
      await prisma.webhook.update({
        where: { id: hook.id },
        data: { lastFiredAt: new Date(), lastStatus: res.status },
      });
    } catch (err) {
      app.log.warn({ err, hookId: hook.id }, "webhook failed");
      await prisma.webhook.update({
        where: { id: hook.id },
        data: { lastFiredAt: new Date(), lastStatus: 0 },
      });
    }
  }
}

export function mintWebhookSecret() {
  return `whsec_${randomBytes(18).toString("base64url")}`;
}

export { EVENT_NAMES };
