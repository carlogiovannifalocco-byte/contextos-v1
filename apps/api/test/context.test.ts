import { describe, expect, it } from "vitest";
import {
  clampBudget,
  compileContext,
  DEFAULT_BUDGET_TOKENS,
  estimateTokens,
  findSupersededIds,
  MAX_BUDGET_TOKENS,
  MIN_BUDGET_TOKENS,
  type ContextMemory,
} from "../src/services/context.js";

const NOW = new Date("2026-08-29T12:00:00.000Z");

function memory(over: Partial<ContextMemory> & { id: string }): ContextMemory {
  return {
    type: "note",
    title: `Entry ${over.id}`,
    body: "Body text.",
    tags: [],
    pinned: false,
    verified: false,
    currentVersion: 1,
    sourcePath: null,
    reviewedAt: null,
    updatedAt: NOW,
    createdByType: "agent",
    ...over,
  };
}

function compile(over: Partial<Parameters<typeof compileContext>[0]> = {}) {
  return compileContext({
    project: { id: "p1", name: "Atlas CLI", description: "Local-first knowledge CLI." },
    memories: [],
    relations: [],
    openTasks: [],
    openConflicts: [],
    openHandoffs: [],
    agents: [],
    now: NOW,
    ...over,
  });
}

describe("clampBudget", () => {
  it("falls back to the default for junk input", () => {
    expect(clampBudget("not a number")).toBe(DEFAULT_BUDGET_TOKENS);
    expect(clampBudget(undefined)).toBe(DEFAULT_BUDGET_TOKENS);
  });

  it("keeps the budget inside supported bounds", () => {
    expect(clampBudget(10)).toBe(MIN_BUDGET_TOKENS);
    expect(clampBudget(999_999)).toBe(MAX_BUDGET_TOKENS);
    expect(clampBudget(1500)).toBe(1500);
  });
});

describe("findSupersededIds", () => {
  it("collects only the targets of supersedes links", () => {
    const ids = findSupersededIds([
      { fromId: "new", toId: "old", kind: "supersedes" },
      { fromId: "a", toId: "b", kind: "references" },
    ]);
    expect([...ids]).toEqual(["old"]);
  });
});

describe("compileContext", () => {
  it("excludes superseded entries from the brief", () => {
    const result = compile({
      memories: [memory({ id: "new", title: "Use gitignore syntax" }), memory({ id: "old", title: "Use glob-only" })],
      relations: [{ fromId: "new", toId: "old", kind: "supersedes" }],
    });

    expect(result.included.map((e) => e.memory.id)).toEqual(["new"]);
    expect(result.supersededIds).toEqual(["old"]);
    expect(result.counts.superseded).toBe(1);
    expect(result.markdown).not.toContain("Use glob-only");
  });

  it("ranks pinned above verified, and verified above a plain note", () => {
    const result = compile({
      memories: [
        memory({ id: "plain" }),
        memory({ id: "verified", verified: true }),
        memory({ id: "pinned", pinned: true }),
      ],
    });

    expect(result.included.map((e) => e.memory.id)).toEqual(["pinned", "verified", "plain"]);
  });

  it("weights entry type so a constraint outranks a note of equal age", () => {
    const result = compile({
      memories: [memory({ id: "note", type: "note" }), memory({ id: "constraint", type: "constraint" })],
    });

    expect(result.included[0]!.memory.id).toBe("constraint");
  });

  it("promotes entries matching the focus query", () => {
    const memories = [
      memory({ id: "db", title: "Postgres is the only datastore", type: "decision" }),
      memory({ id: "ignore", title: "Ignore file syntax", body: "Uses gitignore negation.", type: "decision" }),
    ];

    const unfocused = compile({ memories });
    const focused = compile({ memories, focus: "ignore file syntax" });

    expect(focused.included[0]!.memory.id).toBe("ignore");
    expect(focused.focus).toBe("ignore file syntax");
    expect(unfocused.focus).toBeNull();
  });

  it("flags entries that sit inside an open conflict", () => {
    const result = compile({
      memories: [memory({ id: "a" }), memory({ id: "b" })],
      openConflicts: [{ id: "c1", reason: "Two agents disagree on ignore syntax.", memoryAId: "a", memoryBId: "b" }],
    });

    expect(result.included.every((e) => e.contested)).toBe(true);
    expect(result.markdown).toContain("Open conflicts — stop before acting");
    expect(result.markdown).toContain("CONTESTED");
  });

  it("stays inside the token budget and reports what it dropped", () => {
    const memories = Array.from({ length: 40 }, (_, i) =>
      memory({ id: `m${i}`, body: "A fairly long body ".repeat(20) }),
    );

    const result = compile({ memories, budgetTokens: 600 });

    expect(result.budget.usedTokens).toBeLessThanOrEqual(600);
    expect(result.counts.included).toBeGreaterThan(0);
    expect(result.counts.omitted).toBeGreaterThan(0);
    expect(result.counts.included + result.counts.omitted).toBe(40);
    expect(estimateTokens(result.markdown)).toBeLessThanOrEqual(600);
  });

  it("truncates pinned memory rather than dropping it when the budget is tight", () => {
    const result = compile({
      memories: [memory({ id: "pinned", pinned: true, body: "x".repeat(6000) })],
      budgetTokens: MIN_BUDGET_TOKENS,
    });

    const entry = result.included.find((e) => e.memory.id === "pinned");
    expect(entry).toBeDefined();
    expect(entry!.truncated).toBe(true);
    expect(result.markdown).toContain("…");
  });

  it("marks an entry stale when it has not been reviewed for months", () => {
    const result = compile({
      memories: [memory({ id: "old", updatedAt: new Date("2025-01-01T00:00:00.000Z") })],
    });

    expect(result.included[0]!.stale).toBe(true);
    expect(result.markdown).toContain("not reviewed recently");
  });

  it("labels its token numbers as estimates", () => {
    const result = compile();
    expect(result.budget.estimated).toBe(true);
    expect(result.budget.note).toMatch(/estimated/i);
  });

  it("keeps rules and open work in the brief even with no memory", () => {
    const result = compile({
      openTasks: [{ id: "t1", title: "Ship the scanner", status: "open" }],
      agents: [{ id: "a1", name: "Forge", kind: "cursor", presence: "online", activity: "writing scanner" }],
    });

    expect(result.markdown).toContain("Ship the scanner");
    expect(result.markdown).toContain("Forge");
    expect(result.markdown).toContain("## Rules");
  });
});
