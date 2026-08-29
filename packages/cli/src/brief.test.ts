import { describe, expect, it } from "vitest";
import { estimateTokens, parseContextPackage, renderBriefMarkdown, type ContextPackage } from "./brief.js";

const apiPayload = {
  project: { id: "cmproject123", name: "Atlas CLI", description: "Terminal client for Atlas." },
  generatedAt: "2026-08-29T10:00:00.000Z",
  memories: [
    {
      type: "decision",
      title: "Use Postgres",
      body: "Single Postgres instance, no read replicas.",
      tags: ["db"],
      pinned: true,
      verified: true,
    },
    {
      type: "convention",
      title: "Ignore file syntax",
      body: "Glob patterns only, one per line.",
      tags: [],
      pinned: false,
      verified: false,
    },
  ],
  openTasks: [{ title: "Ship the CLI", status: "in_progress", description: "Zero-friction onboarding." }],
  openConflicts: [{ reason: "Two conventions describe the ignore file", status: "open" }],
  openHandoffs: [{ summary: "Scribe → Forge", details: "Docs are stale", status: "open" }],
  agents: [{ name: "Forge", kind: "mcp", presence: "online", activity: "refactoring" }],
};

describe("parseContextPackage", () => {
  it("reads the documented payload", () => {
    const parsed = parseContextPackage(apiPayload);
    expect(parsed.project.name).toBe("Atlas CLI");
    expect(parsed.memories).toHaveLength(2);
    expect(parsed.memories[0]?.pinned).toBe(true);
    expect(parsed.agents[0]?.presence).toBe("online");
  });

  it("survives an empty or unexpected payload", () => {
    const parsed = parseContextPackage({ memories: "not-an-array", agents: [null, 3] });
    expect(parsed.project.name).toBe("Untitled project");
    expect(parsed.memories).toEqual([]);
    expect(parsed.agents).toEqual([]);
    expect(() => renderBriefMarkdown(parsed)).not.toThrow();
  });
});

describe("renderBriefMarkdown", () => {
  const rendered = renderBriefMarkdown(parseContextPackage(apiPayload));

  it("leads with the project and a countable summary", () => {
    expect(rendered.startsWith("# Atlas CLI — ContextOS brief")).toBe(true);
    expect(rendered).toContain("2 memory entries · 1 open task · 1 open conflict · 1 agent");
  });

  it("includes every section with real content", () => {
    expect(rendered).toContain("## Memory");
    expect(rendered).toContain("### Use Postgres");
    expect(rendered).toContain("`decision · pinned · verified`");
    expect(rendered).toContain("## Open tasks");
    expect(rendered).toContain("**Ship the CLI** `in_progress`");
    expect(rendered).toContain("## Open conflicts");
    expect(rendered).toContain("## Open handoffs");
    expect(rendered).toContain("## Agents");
    expect(rendered).toContain("Forge (mcp) — online, refactoring");
  });

  it("states the human-verify rule so agents read it", () => {
    expect(rendered).toContain("Humans verify memory");
  });

  it("omits sections that have nothing in them", () => {
    const empty: ContextPackage = {
      project: { name: "Empty", description: "" },
      generatedAt: "",
      memories: [],
      openTasks: [],
      openConflicts: [],
      openHandoffs: [],
      agents: [],
    };
    const out = renderBriefMarkdown(empty);
    expect(out).not.toContain("## Memory");
    expect(out).not.toContain("## Open conflicts");
    expect(out).toContain("## Rules");
  });

  it("floats focus matches to the top of their section", () => {
    const focused = renderBriefMarkdown(parseContextPackage(apiPayload), { focus: "ignore file" });
    expect(focused).toContain('focus "ignore file"');
    expect(focused.indexOf("### Ignore file syntax")).toBeLessThan(focused.indexOf("### Use Postgres"));
  });

  it("trims to a token budget and says so", () => {
    const budget = 60;
    const trimmed = renderBriefMarkdown(parseContextPackage(apiPayload), { budget });
    expect(estimateTokens(trimmed)).toBeLessThan(estimateTokens(rendered));
    expect(trimmed).toMatch(/_Trimmed \d+ items? to stay near the 60-token budget\._/);
    expect(trimmed.startsWith("# Atlas CLI — ContextOS brief")).toBe(true);
  });

  it("keeps focused items when the budget is tight", () => {
    const trimmed = renderBriefMarkdown(parseContextPackage(apiPayload), { budget: 90, focus: "Postgres" });
    expect(trimmed).toContain("### Use Postgres");
  });
});
