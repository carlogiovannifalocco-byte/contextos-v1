import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { APP_NAME, APP_VERSION, CSRF_HEADER } from "@contextos/shared";
import { originAllowed, type Env } from "./env.js";
import { contentSecurityPolicyForUrl } from "./lib/csp.js";
import { resolveActor } from "./lib/auth.js";
import { csrfGuard } from "./lib/csrf.js";
import { agentRoutes } from "./routes/agents.js";
import { authRoutes } from "./routes/auth.js";
import { conflictRoutes } from "./routes/conflicts.js";
import { eventRoutes, websocketRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";
import { memoryRoutes } from "./routes/memory.js";
import { projectRoutes } from "./routes/projects.js";
import { scanRoutes } from "./routes/scan.js";
import { taskRoutes } from "./routes/tasks.js";
import { webhookRoutes } from "./routes/webhooks.js";

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
    },
    trustProxy: true,
    ajv: {
      customOptions: {
        strict: false,
        keywords: ["example"],
      },
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Content-Security-Policy", contentSecurityPolicyForUrl(req.url));
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      cb(null, originAllowed(env, origin));
    },
    credentials: true,
    allowedHeaders: ["content-type", "authorization", CSRF_HEADER],
  });
  await app.register(cookie, { secret: env.COOKIE_SECRET });
  await app.register(rateLimit, {
    global: true,
    max: env.NODE_ENV === "production" ? 300 : 1000,
    timeWindow: "1 minute",
  });
  await app.register(websocket);
  await app.register(swagger, {
    openapi: {
      info: {
        title: `${APP_NAME} API`,
        version: APP_VERSION,
        description:
          "Shared memory layer for AI coding agents. Browser clients use session cookies + CSRF. Agents use Bearer cos_… keys.",
      },
      tags: [
        { name: "health" },
        { name: "auth" },
        { name: "projects" },
        { name: "memory" },
        { name: "agents" },
        { name: "tasks" },
        { name: "scan" },
        { name: "conflicts" },
        { name: "events" },
        { name: "webhooks" },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs", uiConfig: { validatorUrl: null } });

  app.addHook("onRequest", async (req) => {
    req.actor = await resolveActor(req);
  });
  app.addHook("preHandler", csrfGuard(env));

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Request validation failed.",
        details: err.flatten(),
      });
    }
    if (err.validation) {
      return reply.code(400).send({ error: "Bad Request", message: err.message });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.name, message: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: "Internal Server Error", message: "Something went wrong." });
  });

  await healthRoutes(app);
  await authRoutes(app, env);
  await projectRoutes(app);
  await memoryRoutes(app);
  await agentRoutes(app);
  await taskRoutes(app);
  await scanRoutes(app);
  await conflictRoutes(app);
  await eventRoutes(app);
  await webhookRoutes(app);
  await websocketRoutes(app);

  return app;
}
