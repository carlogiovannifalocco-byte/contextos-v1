import type { FastifyInstance, FastifyReply } from "fastify";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@contextos/shared";
import { prisma } from "@contextos/db";
import type { Env } from "../env.js";
import { hashToken, randomToken } from "./crypto.js";

export function cookieOpts(env: Env) {
  const secure =
    env.NODE_ENV === "production" &&
    (process.env.COOKIE_SECURE === "true" || env.PUBLIC_WEB_ORIGIN.startsWith("https:"));
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure,
    signed: false,
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function createSession(
  app: FastifyInstance,
  env: Env,
  reply: FastifyReply,
  userId: string,
  meta: { ip?: string; userAgent?: string },
) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip?.slice(0, 80),
      userAgent: meta.userAgent?.slice(0, 300),
    },
  });
  reply.setCookie(SESSION_COOKIE, token, cookieOpts(env));
  return csrfToken;
}

export async function clearSession(env: Env, reply: FastifyReply, token?: string) {
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  reply.clearCookie(SESSION_COOKIE, cookieOpts(env));
}
