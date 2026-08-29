import type { FastifyReply, FastifyRequest } from "fastify";
import { CSRF_HEADER } from "@contextos/shared";
import { originAllowed, type Env } from "../env.js";
import { safeEqual } from "./crypto.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfGuard(env: Env) {
  return async function csrf(req: FastifyRequest, reply: FastifyReply) {
    if (SAFE.has(req.method)) return;
    if (!req.actor || req.actor.kind !== "user") return;

    const origin = req.headers.origin;
    if (env.NODE_ENV === "production" && !origin) {
      await reply.code(403).send({ error: "Forbidden", message: "Origin is not allowed." });
      return reply;
    }
    if (!originAllowed(env, origin)) {
      await reply.code(403).send({ error: "Forbidden", message: "Origin is not allowed." });
      return reply;
    }

    const header = String(req.headers[CSRF_HEADER] ?? "");
    if (!header || !safeEqual(header, req.actor.csrfToken)) {
      await reply.code(403).send({ error: "Forbidden", message: "CSRF token missing or invalid." });
      return reply;
    }
  };
}
