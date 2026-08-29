import { describe, expect, it } from "vitest";
import { passwordSchema, registerBodySchema } from "./schemas.js";
import { AGENT_KEY_PREFIX, EVENT_NAMES } from "./constants.js";

describe("passwordSchema", () => {
  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("Ab1").success).toBe(false);
  });
  it("accepts a strong-enough password", () => {
    expect(passwordSchema.safeParse("DemoPassw0rd!").success).toBe(true);
  });
});

describe("registerBodySchema", () => {
  it("normalizes email", () => {
    const parsed = registerBodySchema.parse({
      email: "  Demo@ContextOS.dev ",
      password: "DemoPassw0rd!",
      name: "Ada",
    });
    expect(parsed.email).toBe("demo@contextos.dev");
  });
});

describe("constants", () => {
  it("keeps agent key prefix stable", () => {
    expect(AGENT_KEY_PREFIX).toBe("cos_");
  });
  it("emits conflict events", () => {
    expect(EVENT_NAMES.conflictDetected).toBe("conflict.detected");
  });
});
