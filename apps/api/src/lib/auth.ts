import type { FastifyReply, FastifyRequest } from "fastify";
import type { Agent, Project, User } from "@contextos/db";
import { prisma } from "@contextos/db";
import { AGENT_KEY_PREFIX, SESSION_COOKIE } from "@contextos/shared";
import { hashToken } from "./crypto.js";
import { verifyPassword } from "./crypto.js";

export type Actor =
  | { kind: "user"; user: User; sessionId: string; csrfToken: string }
  | { kind: "agent"; agent: Agent; project: Project };

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

export async function resolveActor(req: FastifyRequest): Promise<Actor | null> {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ") && header.slice(7).startsWith(AGENT_KEY_PREFIX)) {
    const raw = header.slice(7).trim();
    const prefix = raw.slice(0, 12);
    const keys = await prisma.agentKey.findMany({
      where: { prefix, revokedAt: null },
      include: { agent: { include: { project: true } } },
    });
    for (const key of keys) {
      if (await verifyPassword(key.keyHash, raw)) {
        return { kind: "agent", agent: key.agent, project: key.agent.project };
      }
    }
    return null;
  }

  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }
  return {
    kind: "user",
    user: session.user,
    sessionId: session.id,
    csrfToken: session.csrfToken,
  };
}

export async function requireActor(req: FastifyRequest, reply: FastifyReply): Promise<Actor | null> {
  const actor = req.actor ?? (await resolveActor(req));
  req.actor = actor;
  if (!actor) {
    await reply.code(401).send({ error: "Unauthorized", message: "Sign in or provide an agent key." });
    return null;
  }
  return actor;
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const actor = await requireActor(req, reply);
  if (!actor) return null;
  if (actor.kind !== "user") {
    await reply.code(403).send({ error: "Forbidden", message: "This action is limited to humans." });
    return null;
  }
  return actor;
}

export async function getProjectAccess(actor: Actor, projectId: string) {
  if (actor.kind === "agent") {
    if (actor.project.id !== projectId) return null;
    return { project: actor.project, role: "agent" as const };
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });
  if (!project) return null;
  if (project.ownerId === actor.user.id) return { project, role: "owner" as const };
  const member = project.members.find((m) => m.userId === actor.user.id);
  if (member) return { project, role: member.role };
  return null;
}

export function isHuman(actor: Actor): actor is Extract<Actor, { kind: "user" }> {
  return actor.kind === "user";
}

export function isOwnerRole(role: string) {
  return role === "owner";
}

export function isWriterRole(role: string) {
  return role === "owner" || role === "member";
}

/** Returns true when the reply was sent and the handler should return early. */
export function denyUnlessWriter(reply: FastifyReply, access: { role: string }): boolean {
  if (!isWriterRole(access.role)) {
    void reply.code(403).send({
      error: "Forbidden",
      message: "Viewers have read-only access to this project.",
    });
    return true;
  }
  return false;
}
