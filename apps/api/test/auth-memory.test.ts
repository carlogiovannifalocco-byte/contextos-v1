import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { CSRF_HEADER, SESSION_COOKIE } from "@contextos/shared";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";

const skipDb = process.env.CONTEXTOS_SKIP_DB_TESTS === "1" || !process.env.DATABASE_URL?.trim();

function cookieHeader(setCookie: string | string[] | undefined) {
  const raw = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

describe.skipIf(skipDb)("auth + memory + conflict", () => {
  const email = `test-${Date.now()}@contextos.dev`;
  const password = "TestPassw0rd!";
  let app: FastifyInstance;
  let cookie = "";
  let csrf = "";
  let projectId = "";
  let memoryA = "";
  let memoryB = "";

  beforeAll(async () => {
    const env = loadEnv({
      ...process.env,
      NODE_ENV: "test",
      COOKIE_SECRET: process.env.COOKIE_SECRET ?? "test-cookie-secret-at-least-32-chars!!",
      DATABASE_URL: process.env.DATABASE_URL!,
      PUBLIC_WEB_ORIGIN: "http://localhost:5173",
      PORT: "3001",
    });
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses unauthenticated project creation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("registers and returns a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, name: "Tester" },
    });
    expect(res.statusCode).toBe(201);
    const json = res.json();
    csrf = json.csrfToken;
    cookie = cookieHeader(res.headers["set-cookie"]);
    expect(cookie).toContain(SESSION_COOKIE);
    expect(csrf).toBeTruthy();
  });

  it("creates a project with CSRF", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { name: "Harbor" },
    });
    expect(res.statusCode).toBe(201);
    projectId = res.json().project.id;
  });

  it("writes two contradictory decisions and detects a conflict", async () => {
    const a = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: {
        type: "decision",
        title: "Auth uses sessions",
        body: "HttpOnly cookies only.",
      },
    });
    expect(a.statusCode).toBe(201);
    memoryA = a.json().memory.id;

    const b = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: {
        type: "decision",
        title: "Auth uses sessions",
        body: "Use JWT in localStorage instead.",
      },
    });
    expect(b.statusCode).toBe(201);
    memoryB = b.json().memory.id;
    expect(b.json().conflicts.length).toBeGreaterThan(0);
  });

  it("merges the conflict", async () => {
    const list = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/conflicts`,
      headers: { cookie },
    });
    const conflict = list.json().conflicts[0];
    const merged = await app.inject({
      method: "POST",
      url: `/api/v1/conflicts/${conflict.id}/merge`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: {
        title: "Auth uses sessions",
        body: "HttpOnly session cookies. JWT in localStorage is rejected.",
      },
    });
    expect(merged.statusCode).toBe(200);
    expect(merged.json().conflict.status).toBe("merged");
    expect(memoryA && memoryB).toBeTruthy();
  });

  it("health reports db up and sends a JSON API CSP", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    const csp = String(res.headers["content-security-policy"] ?? "");
    expect(csp).toMatch(/default-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it("OpenAPI docs keep a CSP that allows Swagger scripts", async () => {
    const res = await app.inject({ method: "GET", url: "/api/docs" });
    expect(res.statusCode).toBe(200);
    const csp = String(res.headers["content-security-policy"] ?? "");
    expect(csp).toMatch(/script-src/);
    expect(csp).toMatch(/style-src/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it("scans fixtures/atlas-cli and activates proposals into memory", async () => {
    const start = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/scan`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { rootPath: "fixtures/atlas-cli" },
    });
    expect(start.statusCode).toBe(202);
    const jobId = start.json().job.id;
    let job: { status: string; proposals: { title: string }[] } | undefined;
    for (let i = 0; i < 40; i++) {
      const st = await app.inject({
        method: "GET",
        url: `/api/v1/scan-jobs/${jobId}`,
        headers: { cookie },
      });
      job = st.json().job;
      if (job?.status === "completed" || job?.status === "failed") break;
      await new Promise((r) => setTimeout(r, 150));
    }
    expect(job?.status).toBe("completed");
    expect(job?.proposals.some((p) => p.title.includes("@atlas/cli"))).toBe(true);
    const act = await app.inject({
      method: "POST",
      url: `/api/v1/scan-jobs/${jobId}/activate`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: {},
    });
    expect(act.statusCode).toBe(200);
    expect(act.json().activated).toBeGreaterThan(0);
    const mem = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/memory?q=@atlas/cli`,
      headers: { cookie },
    });
    expect(mem.json().memories.length).toBeGreaterThan(0);
  });

  it("returns a compiled context brief with markdown format", async () => {
    const json = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/context-package?budget=1500&focus=auth`,
      headers: { cookie },
    });
    expect(json.statusCode).toBe(200);
    const body = json.json();
    expect(body.included.length).toBeGreaterThan(0);
    expect(body.budget.tokens).toBe(1500);
    expect(body.focus).toBe("auth");
    expect(body.markdown).toMatch(/ContextOS brief/);

    const md = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/context-package?format=md&budget=800`,
      headers: { cookie },
    });
    expect(md.statusCode).toBe(200);
    expect(md.headers["content-type"]).toMatch(/text\/markdown/);
    expect(md.body).toMatch(/## Rules/);
  });

  it("supersedes a memory and drops it from the brief", async () => {
    const old = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { type: "note", title: "Old lint rule", body: "Use semicolons everywhere." },
    });
    const newer = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { type: "note", title: "Lint rule", body: "No semicolons — Prettier decides." },
    });
    const rel = await app.inject({
      method: "POST",
      url: `/api/v1/memory/${newer.json().memory.id}/relations`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { toId: old.json().memory.id, kind: "supersedes" },
    });
    expect(rel.statusCode).toBe(201);

    const brief = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/context-package?budget=4000`,
      headers: { cookie },
    });
    const pkg = brief.json();
    expect(pkg.supersededIds).toContain(old.json().memory.id);
    expect(pkg.included.some((e: { memory: { id: string } }) => e.memory.id === old.json().memory.id)).toBe(false);
  });

  it("invites a teammate and lets them see the project", async () => {
    const mateEmail = `mate-${Date.now()}@contextos.dev`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: mateEmail, password, name: "Mate" },
    });
    expect(reg.statusCode).toBe(201);
    const mateCsrf = reg.json().csrfToken;
    const mateCookie = cookieHeader(reg.headers["set-cookie"]);

    const invite = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { email: mateEmail },
    });
    expect(invite.statusCode).toBe(201);
    expect(invite.json().member.email).toBe(mateEmail);

    const team = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie },
    });
    expect(team.json().members).toHaveLength(2);

    const mateProjects = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { cookie: mateCookie },
    });
    expect(mateProjects.json().projects.some((p: { id: string }) => p.id === projectId)).toBe(true);

    const mateWrite = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie: mateCookie, [CSRF_HEADER]: mateCsrf },
      payload: { type: "note", title: "From mate", body: "Shared write access works." },
    });
    expect(mateWrite.statusCode).toBe(201);

    const mateUserId = invite.json().member.userId;
    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${projectId}/members/${mateUserId}`,
      headers: { cookie, [CSRF_HEADER]: csrf },
    });
    expect(removed.statusCode).toBe(204);

    const after = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { cookie: mateCookie },
    });
    expect(after.json().projects.some((p: { id: string }) => p.id === projectId)).toBe(false);
  });

  it("queues a pending invite and accepts it when the user registers", async () => {
    const futureEmail = `pending-${Date.now()}@contextos.dev`;
    const queued = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { email: futureEmail },
    });
    expect(queued.statusCode).toBe(202);
    expect(queued.json().pending.email).toBe(futureEmail);

    const roster = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie },
    });
    expect(roster.json().pending).toHaveLength(1);

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: futureEmail, password, name: "Future" },
    });
    expect(reg.statusCode).toBe(201);
    const futureCookie = cookieHeader(reg.headers["set-cookie"]);

    const joined = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { cookie: futureCookie },
    });
    expect(joined.json().projects.some((p: { id: string }) => p.id === projectId)).toBe(true);

    const cleared = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie },
    });
    expect(cleared.json().pending).toHaveLength(0);
    expect(cleared.json().members.some((m: { email: string }) => m.email === futureEmail)).toBe(true);
  });

  it("gives viewers read access but blocks writes", async () => {
    const viewerEmail = `viewer-${Date.now()}@contextos.dev`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: viewerEmail, password, name: "Viewer" },
    });
    expect(reg.statusCode).toBe(201);
    const viewerCookie = cookieHeader(reg.headers["set-cookie"]);
    const viewerCsrf = reg.json().csrfToken;

    const invite = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { email: viewerEmail, role: "viewer" },
    });
    expect(invite.statusCode).toBe(201);
    expect(invite.json().member.role).toBe("viewer");

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { cookie: cookieHeader(reg.headers["set-cookie"]) },
    });
    expect(listed.json().projects.some((p: { id: string; role: string }) => p.id === projectId && p.role === "viewer")).toBe(true);

    const read = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie: viewerCookie },
    });
    expect(read.statusCode).toBe(200);

    const write = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie: viewerCookie, [CSRF_HEADER]: viewerCsrf },
      payload: { type: "note", title: "Blocked", body: "Viewers cannot write." },
    });
    expect(write.statusCode).toBe(403);
  });

  it("lets the owner promote a viewer to member", async () => {
    const viewerEmail = `promote-${Date.now()}@contextos.dev`;
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: viewerEmail, password, name: "Promote" },
    });
    const viewerId = reg.json().user.id;

    const invite = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/members`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { email: viewerEmail, role: "viewer" },
    });
    expect(invite.statusCode).toBe(201);

    const promoted = await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/${projectId}/members/${viewerId}`,
      headers: { cookie, [CSRF_HEADER]: csrf },
      payload: { role: "member" },
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.json().member.role).toBe("member");

    const write = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/memory`,
      headers: { cookie: cookieHeader(reg.headers["set-cookie"]), [CSRF_HEADER]: reg.json().csrfToken },
      payload: { type: "note", title: "Now allowed", body: "Promoted to member." },
    });
    expect(write.statusCode).toBe(201);
  });
});
