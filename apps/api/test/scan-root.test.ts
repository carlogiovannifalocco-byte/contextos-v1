import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveScanRoot } from "../src/services/scan-root.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("resolveScanRoot", () => {
  it("finds fixtures/atlas-cli from the repo even when cwd is apps/api", () => {
    const resolved = resolveScanRoot("fixtures/atlas-cli");
    expect(resolved.replace(/\\/g, "/")).toContain("fixtures/atlas-cli");
    expect(path.basename(path.dirname(resolved))).toBe("fixtures");
    expect(resolved.startsWith(repoRoot) || resolved.includes("atlas-cli")).toBe(true);
  });
});
