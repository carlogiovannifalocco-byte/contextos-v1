import type { FastifyInstance } from "fastify";
import { prisma } from "@contextos/db";
import {
  changePasswordBodySchema,
  loginBodySchema,
  patchMeBodySchema,
  registerBodySchema,
  SESSION_COOKIE,
} from "@contextos/shared";
import { hashPassword, hashToken, verifyPassword } from "../lib/crypto.js";
import { requireUser, resolveActor } from "../lib/auth.js";
import { clearSession, createSession } from "../lib/session.js";
import { acceptPendingInvites } from "../services/invites.js";
import type { Env } from "../env.js";

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  language: string;
  theme: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language,
    theme: user.theme,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance, env: Env) {
  app.post(
    "/api/v1/auth/register",
    {
      config: { rateLimit: { max: 8, timeWindow: "15 minutes" } },
      schema: {
        tags: ["auth"],
        summary: "Create an account",
        description: "Hashes the password with argon2id and opens a session cookie.",
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", example: "ada@example.com" },
            password: { type: "string", example: "DemoPassw0rd!" },
            name: { type: "string", example: "Ada" },
            language: { type: "string", enum: ["en", "it"] },
          },
        },
      },
    },
    async (req, reply) => {
      const body = registerBodySchema.parse(req.body);
      const exists = await prisma.user.findUnique({ where: { email: body.email } });
      if (exists) {
        return reply.code(409).send({ error: "Conflict", message: "An account with that email already exists." });
      }
      const user = await prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          language: body.language ?? "en",
          passwordHash: await hashPassword(body.password),
        },
      });
      await acceptPendingInvites(user.id, user.email);
      const csrfToken = await createSession(app, env, reply, user.id, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.code(201).send({ user: publicUser(user), csrfToken });
    },
  );

  app.post(
    "/api/v1/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
      schema: {
        tags: ["auth"],
        summary: "Sign in",
        description: "Sets an HttpOnly session cookie. Send the returned CSRF token on mutating browser requests.",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", example: "demo@contextos.dev" },
            password: { type: "string", example: "DemoPassw0rd!" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = loginBodySchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
        return reply.code(401).send({ error: "Unauthorized", message: "Email or password is incorrect." });
      }
      const csrfToken = await createSession(app, env, reply, user.id, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return { user: publicUser(user), csrfToken };
    },
  );

  app.post("/api/v1/auth/logout", { schema: { tags: ["auth"], summary: "Sign out" } }, async (req, reply) => {
    await clearSession(env, reply, req.cookies[SESSION_COOKIE]);
    return { ok: true };
  });

  app.get("/api/v1/auth/status", { schema: { tags: ["auth"], summary: "Session presence" } }, async (req) => {
    const actor = req.actor ?? (await resolveActor(req));
    req.actor = actor;
    return { authenticated: Boolean(actor && actor.kind === "user") };
  });

  app.get("/api/v1/auth/csrf", { schema: { tags: ["auth"], summary: "Fetch CSRF token for the current session" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    return { csrfToken: actor.csrfToken };
  });

  app.get("/api/v1/auth/me", { schema: { tags: ["auth"], summary: "Current user" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    return { user: publicUser(actor.user) };
  });

  app.patch("/api/v1/auth/me", { schema: { tags: ["auth"], summary: "Update profile" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const body = patchMeBodySchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: actor.user.id },
      data: {
        name: body.name,
        language: body.language,
        theme: body.theme,
      },
    });
    return { user: publicUser(user) };
  });

  app.post("/api/v1/auth/change-password", { schema: { tags: ["auth"], summary: "Change password" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const body = changePasswordBodySchema.parse(req.body);
    if (!(await verifyPassword(actor.user.passwordHash, body.currentPassword))) {
      return reply.code(400).send({ error: "Bad Request", message: "Current password is incorrect." });
    }
    await prisma.user.update({
      where: { id: actor.user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    await prisma.session.deleteMany({
      where: { userId: actor.user.id, tokenHash: { not: hashToken(req.cookies[SESSION_COOKIE] ?? "") } },
    });
    return { ok: true };
  });

  app.get("/api/v1/auth/export", { schema: { tags: ["auth"], summary: "Export account JSON" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    const projects = await prisma.project.findMany({
      where: { ownerId: actor.user.id },
      include: { memories: true, tasks: true, agents: true, events: true, conflicts: true },
    });
    return {
      exportedAt: new Date().toISOString(),
      user: publicUser(actor.user),
      projects,
    };
  });

  app.delete("/api/v1/auth/me", { schema: { tags: ["auth"], summary: "Delete account and owned projects" } }, async (req, reply) => {
    const actor = await requireUser(req, reply);
    if (!actor) return;
    await prisma.user.delete({ where: { id: actor.user.id } });
    await clearSession(env, reply, req.cookies[SESSION_COOKIE]);
    return reply.code(204).send();
  });
}
