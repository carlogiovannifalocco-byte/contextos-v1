import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";

describe("openapi", () => {
  it("documents session + agent auth and core tags", async () => {
    const app = await buildApp(loadEnv());
    const res = await app.inject({ method: "GET", url: "/api/docs/json" });
    expect(res.statusCode).toBe(200);
    const spec = res.json() as {
      openapi?: string;
      info?: { title?: string };
      tags?: { name: string }[];
      components?: { securitySchemes?: Record<string, unknown> };
      paths?: Record<string, unknown>;
    };
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info?.title).toContain("ContextOS");
    expect(spec.components?.securitySchemes?.agentBearer).toBeTruthy();
    expect(spec.components?.securitySchemes?.sessionCookie).toBeTruthy();
    const tagNames = (spec.tags ?? []).map((t) => t.name);
    for (const name of ["auth", "projects", "memory", "agents"]) {
      expect(tagNames).toContain(name);
    }
    expect(spec.paths?.["/api/v1/projects/{id}/context-package"]).toBeTruthy();
    await app.close();
  });
});
