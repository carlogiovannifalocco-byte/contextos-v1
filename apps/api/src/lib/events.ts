import type { FastifyInstance } from "fastify";
import type { ActorType, Prisma } from "@contextos/db";
import { prisma } from "@contextos/db";
import { hub } from "./realtime.js";
import { dispatchWebhooks } from "../services/webhooks.js";

export async function emitEvent(
  app: FastifyInstance,
  input: {
    projectId: string;
    type: string;
    payload?: Record<string, unknown>;
    actorType?: ActorType;
    actorUserId?: string | null;
    actorAgentId?: string | null;
  },
) {
  const event = await prisma.event.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonObject,
      actorType: input.actorType ?? "system",
      actorUserId: input.actorUserId ?? null,
      actorAgentId: input.actorAgentId ?? null,
    },
  });
  const dto = {
    id: event.id,
    projectId: event.projectId,
    type: event.type,
    payload: event.payload,
    actorType: event.actorType,
    actorUserId: event.actorUserId,
    actorAgentId: event.actorAgentId,
    createdAt: event.createdAt.toISOString(),
  };
  hub.publish(input.projectId, dto);
  void dispatchWebhooks(app, input.projectId, dto).catch((err) => {
    app.log.warn({ err }, "webhook dispatch failed");
  });
  return dto;
}
