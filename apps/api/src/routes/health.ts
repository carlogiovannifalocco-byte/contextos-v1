import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import { APP_VERSION } from "@contextos/shared";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/api/health",
    {
      schema: {
        tags: ["health"],
        summary: "Liveness and database check",
        description: "Unauthenticated. Used by Docker healthchecks.",
        response: {
          200: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              version: { type: "string", example: APP_VERSION },
              db: { type: "string", example: "up" },
              time: { type: "string" },
            },
          },
          503: {
            description: "The API is running but the database is unreachable.",
            type: "object",
            properties: {
              ok: { type: "boolean" },
              version: { type: "string", example: APP_VERSION },
              db: { type: "string", example: "down" },
              time: { type: "string" },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      let db: "up" | "down" = "down";
      try {
        await prisma.$queryRaw`SELECT 1`;
        db = "up";
      } catch {
        db = "down";
      }
      const ok = db === "up";
      return reply.code(ok ? 200 : 503).send({
        ok,
        version: APP_VERSION,
        db,
        time: new Date().toISOString(),
      });
    },
  );
}
