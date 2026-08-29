import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

describe("production COOKIE_SECRET", () => {
  const base = {
    DATABASE_URL: "postgresql://contextos:contextos@localhost:5432/contextos",
    PUBLIC_WEB_ORIGIN: "http://localhost:8080",
    PORT: "3001",
  };

  it("refuses a missing or short secret", () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", COOKIE_SECRET: "short" }),
    ).toThrow(/COOKIE_SECRET/);
  });

  it("refuses a placeholder secret", () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: "production",
        COOKIE_SECRET: "dev-only-change-me-use-32-plus-chars!!",
      }),
    ).toThrow(/weak/i);
  });

  it("accepts a long random secret", () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: "production",
      COOKIE_SECRET: "a".repeat(48),
    });
    expect(env.COOKIE_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
