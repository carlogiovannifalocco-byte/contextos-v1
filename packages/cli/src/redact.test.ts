import { describe, expect, it } from "vitest";
import { redactKey, redactSecrets } from "./redact.js";

const KEY = "cos_ELa2m5rXQ9kZtP7hVw3JdN6bYc1Ufg8s";

describe("redactKey", () => {
  it("keeps the 12-character prefix the dashboard shows", () => {
    expect(redactKey(KEY)).toBe("cos_ELa2m5rX…");
  });

  it("never reveals a short key", () => {
    expect(redactKey("cos_short")).toBe("cos_…");
    expect(redactKey("cos_")).toBe("***");
  });

  it("refuses to treat anything else as a key", () => {
    expect(redactKey("hunter2")).toBe("***");
    expect(redactKey("")).toBe("***");
  });

  it("tolerates surrounding whitespace", () => {
    expect(redactKey(`  ${KEY}\n`)).toBe("cos_ELa2m5rX…");
  });
});

describe("redactSecrets", () => {
  it("redacts every key inside a message", () => {
    const message = `ContextOS API 401: key ${KEY} was rejected (previous ${KEY}x)`;
    const redacted = redactSecrets(message);
    expect(redacted).not.toContain("ELa2m5rXQ9kZ");
    expect(redacted).toContain("cos_ELa2m5rX…");
    expect(redacted.startsWith("ContextOS API 401:")).toBe(true);
  });

  it("leaves key-free text untouched", () => {
    expect(redactSecrets("nothing secret here")).toBe("nothing secret here");
  });
});
