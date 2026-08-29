import { bm25, normalize } from "../lib/rank.js";

export const DEFAULT_BUDGET_TOKENS = 2000;
export const MIN_BUDGET_TOKENS = 200;
export const MAX_BUDGET_TOKENS = 32_000;

/** Chars-per-token is a heuristic, not a tokenizer. Every budget we report is an estimate. */
const CHARS_PER_TOKEN = 4;
const RECENCY_HALF_LIFE_DAYS = 60;
const STALE_AFTER_DAYS = 120;

const TYPE_WEIGHT: Record<string, number> = {
  constraint: 200,
  decision: 180,
  convention: 160,
  risk: 140,
  fact: 90,
  note: 40,
};

const SECTION_ORDER = ["constraint", "decision", "convention", "risk", "fact", "note"] as const;

const SECTION_TITLE: Record<string, string> = {
  constraint: "Hard constraints",
  decision: "Decisions",
  convention: "Conventions",
  risk: "Known risks",
  fact: "Facts",
  note: "Notes",
};

export type ContextMemory = {
  id: string;
  type: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  verified: boolean;
  currentVersion: number;
  sourcePath?: string | null;
  reviewedAt?: Date | string | null;
  updatedAt: Date | string;
  createdByType: string;
};

export type ContextRelation = {
  fromId: string;
  toId: string;
  kind: string;
};

export type ContextTask = {
  id: string;
  title: string;
  status: string;
  assigneeAgentId?: string | null;
};

export type ContextConflict = {
  id: string;
  reason: string;
  memoryAId: string;
  memoryBId: string;
};

export type ContextAgent = {
  id: string;
  name: string;
  kind: string;
  presence: string;
  activity: string;
};

export type ContextHandoff = {
  id: string;
  summary: string;
  details?: string;
};

export type CompileInput = {
  project: { id: string; name: string; description: string };
  memories: readonly ContextMemory[];
  relations: readonly ContextRelation[];
  openTasks: readonly ContextTask[];
  openConflicts: readonly ContextConflict[];
  openHandoffs: readonly ContextHandoff[];
  agents: readonly ContextAgent[];
  focus?: string | undefined;
  budgetTokens?: number | undefined;
  now?: Date | undefined;
};

export type ScoredMemory = {
  memory: ContextMemory;
  score: number;
  reasons: string[];
  stale: boolean;
  contested: boolean;
  truncated: boolean;
  tokens: number;
};

export type CompiledContext = {
  project: { id: string; name: string; description: string };
  generatedAt: string;
  focus: string | null;
  budget: {
    tokens: number;
    usedTokens: number;
    estimated: true;
    note: string;
  };
  counts: {
    candidates: number;
    included: number;
    omitted: number;
    superseded: number;
  };
  included: ScoredMemory[];
  omitted: { id: string; title: string; type: string }[];
  supersededIds: string[];
  openTasks: readonly ContextTask[];
  openConflicts: readonly ContextConflict[];
  openHandoffs: readonly ContextHandoff[];
  agents: readonly ContextAgent[];
  instructions: Record<string, string>;
  markdown: string;
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function clampBudget(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BUDGET_TOKENS;
  return Math.min(MAX_BUDGET_TOKENS, Math.max(MIN_BUDGET_TOKENS, Math.floor(n)));
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function daysBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 86_400_000;
}

/**
 * A memory that another entry explicitly supersedes is dead context: keeping it
 * would feed an agent a decision the team already replaced.
 */
export function findSupersededIds(relations: readonly ContextRelation[]): Set<string> {
  const superseded = new Set<string>();
  for (const rel of relations) {
    if (rel.kind === "supersedes") superseded.add(rel.toId);
  }
  return superseded;
}

function renderEntry(entry: ScoredMemory): string {
  const flags: string[] = [];
  if (entry.memory.pinned) flags.push("pinned");
  if (entry.memory.verified) flags.push("verified by a human");
  else flags.push("unverified");
  if (entry.contested) flags.push("CONTESTED");
  if (entry.stale) flags.push("not reviewed recently");
  const source = entry.memory.sourcePath ? ` \`${entry.memory.sourcePath}\`` : "";
  const body = entry.truncated ? `${entry.memory.body.trimEnd()}…` : entry.memory.body;
  return `- **${entry.memory.title}** — ${body}${source}\n  _(${flags.join(", ")})_`;
}

function renderMarkdown(ctx: Omit<CompiledContext, "markdown">): string {
  const lines: string[] = [];
  lines.push(`# ContextOS brief — ${ctx.project.name}`);
  if (ctx.project.description) lines.push("", ctx.project.description);
  lines.push(
    "",
    `Generated ${ctx.generatedAt} · ${ctx.counts.included} of ${ctx.counts.candidates} entries · ~${ctx.budget.usedTokens}/${ctx.budget.tokens} est. tokens`,
  );
  if (ctx.focus) lines.push(`Focus: **${ctx.focus}**`);

  if (ctx.openConflicts.length > 0) {
    lines.push("", "## Open conflicts — stop before acting on these topics");
    for (const conflict of ctx.openConflicts) lines.push(`- ${conflict.reason}`);
  }

  const byType = new Map<string, ScoredMemory[]>();
  for (const entry of ctx.included) {
    const list = byType.get(entry.memory.type) ?? [];
    list.push(entry);
    byType.set(entry.memory.type, list);
  }
  for (const type of SECTION_ORDER) {
    const entries = byType.get(type);
    if (!entries || entries.length === 0) continue;
    lines.push("", `## ${SECTION_TITLE[type] ?? type}`);
    for (const entry of entries) lines.push(renderEntry(entry));
  }

  if (ctx.openTasks.length > 0) {
    lines.push("", "## Open tasks");
    for (const task of ctx.openTasks) lines.push(`- [${task.status}] ${task.title}`);
  }

  if (ctx.openHandoffs.length > 0) {
    lines.push("", "## Waiting handoffs");
    for (const handoff of ctx.openHandoffs) lines.push(`- ${handoff.summary}`);
  }

  const active = ctx.agents.filter((a) => a.presence !== "offline");
  if (active.length > 0) {
    lines.push("", "## Agents working right now");
    for (const agent of active) {
      lines.push(`- ${agent.name} (${agent.kind}) — ${agent.presence}${agent.activity ? `: ${agent.activity}` : ""}`);
    }
  }

  lines.push("", "## Rules");
  for (const value of Object.values(ctx.instructions)) lines.push(`- ${value}`);

  if (ctx.counts.omitted > 0) {
    lines.push(
      "",
      `_${ctx.counts.omitted} lower-priority entries were left out of this budget. Raise \`budget\` or search memory directly._`,
    );
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Turns the raw shared brain into a ranked brief that fits a token budget.
 * Pure by design: the route supplies data, this decides what an agent should read.
 */
export function compileContext(input: CompileInput): CompiledContext {
  const now = input.now ?? new Date();
  const budgetTokens = clampBudget(input.budgetTokens ?? DEFAULT_BUDGET_TOKENS);
  const focus = input.focus?.trim() ? input.focus.trim() : null;

  const supersededIds = findSupersededIds(input.relations);
  const candidates = input.memories.filter((m) => !supersededIds.has(m.id));

  const contested = new Set<string>();
  for (const conflict of input.openConflicts) {
    contested.add(conflict.memoryAId);
    contested.add(conflict.memoryBId);
  }

  const relevance = focus
    ? normalize(bm25(candidates.map((m) => ({ id: m.id, title: m.title, body: m.body, tags: m.tags })), focus))
    : new Map<string, number>();

  const scored: ScoredMemory[] = candidates.map((memory) => {
    const reasons: string[] = [];
    let score = TYPE_WEIGHT[memory.type] ?? 50;
    reasons.push(`type:${memory.type}`);

    if (memory.pinned) {
      score += 1000;
      reasons.push("pinned");
    }
    if (memory.verified) {
      score += 250;
      reasons.push("verified");
    }
    if (contested.has(memory.id)) {
      score += 300;
      reasons.push("contested");
    }

    const updated = toDate(memory.updatedAt);
    if (updated) {
      const age = Math.max(0, daysBetween(now, updated));
      score += 120 * Math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS);
    }

    const relevanceScore = relevance.get(memory.id);
    if (relevanceScore !== undefined) {
      score += 400 * relevanceScore;
      reasons.push("matches focus");
    }

    const reviewed = toDate(memory.reviewedAt) ?? updated;
    const stale = reviewed ? daysBetween(now, reviewed) > STALE_AFTER_DAYS : false;
    if (stale) {
      score -= 60;
      reasons.push("stale");
    }

    return {
      memory,
      score: Math.round(score),
      reasons,
      stale,
      contested: contested.has(memory.id),
      truncated: false,
      tokens: 0,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.memory.title.localeCompare(b.memory.title));

  const shell: Omit<CompiledContext, "markdown"> = {
    project: input.project,
    generatedAt: now.toISOString(),
    focus,
    budget: {
      tokens: budgetTokens,
      usedTokens: 0,
      estimated: true,
      note: "Token counts are estimated from character length, not a model tokenizer.",
    },
    counts: { candidates: candidates.length, included: 0, omitted: 0, superseded: supersededIds.size },
    included: [],
    omitted: [],
    supersededIds: [...supersededIds],
    openTasks: input.openTasks,
    openConflicts: input.openConflicts,
    openHandoffs: input.openHandoffs,
    agents: input.agents,
    instructions: {
      verify: "Humans verify memory. Never mark an entry verified yourself.",
      conflicts: "If an open conflict covers your topic, stop and hand off instead of picking a side.",
      write: "Write new decisions back with write_memory so the next agent inherits them.",
      supersede: "Replacing an old decision? Link it with supersede_memory instead of leaving both.",
    },
  };

  // Reserve room for the scaffolding so a tight budget never starves the header,
  // conflicts and rules that make the brief safe to act on.
  const overhead = estimateTokens(renderMarkdown({ ...shell, included: [] }));
  let used = overhead;
  const included: ScoredMemory[] = [];
  const omitted: CompiledContext["omitted"] = [];

  for (const entry of scored) {
    const full = estimateTokens(renderEntry({ ...entry, truncated: false }));
    const remaining = budgetTokens - used;

    if (full <= remaining) {
      entry.tokens = full;
      used += full;
      included.push(entry);
      continue;
    }

    // Pinned memory is an explicit human instruction, so trim it rather than drop it.
    if (entry.memory.pinned && remaining > 40) {
      const keepChars = Math.max(0, (remaining - 20) * CHARS_PER_TOKEN);
      const trimmed: ScoredMemory = {
        ...entry,
        memory: { ...entry.memory, body: entry.memory.body.slice(0, keepChars) },
        truncated: true,
      };
      trimmed.tokens = estimateTokens(renderEntry(trimmed));
      used += trimmed.tokens;
      included.push(trimmed);
      continue;
    }

    omitted.push({ id: entry.memory.id, title: entry.memory.title, type: entry.memory.type });
  }

  const compiled: Omit<CompiledContext, "markdown"> = {
    ...shell,
    included,
    omitted,
    budget: { ...shell.budget, usedTokens: used },
    counts: {
      candidates: candidates.length,
      included: included.length,
      omitted: omitted.length,
      superseded: supersededIds.size,
    },
  };

  return { ...compiled, markdown: renderMarkdown(compiled) };
}
