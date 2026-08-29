import { asBoolean, asRecord, asRecordList, asString, asStringList } from "./json.js";

export type BriefMemory = {
  type: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  verified: boolean;
};

export type BriefTask = { title: string; status: string; description: string };
export type BriefConflict = { reason: string; status: string };
export type BriefHandoff = { summary: string; details: string; status: string };
export type BriefAgent = { name: string; kind: string; presence: string; activity: string };

export type ContextPackage = {
  project: { name: string; description: string };
  generatedAt: string;
  memories: BriefMemory[];
  openTasks: BriefTask[];
  openConflicts: BriefConflict[];
  openHandoffs: BriefHandoff[];
  agents: BriefAgent[];
};

export type RenderOptions = { budget?: number; focus?: string };

const MAX_BODY_CHARS = 800;

/** Read the API payload defensively: the endpoint is allowed to grow fields. */
export function parseContextPackage(value: unknown): ContextPackage {
  const root = asRecord(value);
  const project = asRecord(root["project"]);
  return {
    project: {
      name: asString(project["name"], "Untitled project"),
      description: asString(project["description"]),
    },
    generatedAt: asString(root["generatedAt"]),
    memories: asRecordList(root["memories"]).map((memory) => ({
      type: asString(memory["type"], "note"),
      title: asString(memory["title"], "(untitled)"),
      body: asString(memory["body"]),
      tags: asStringList(memory["tags"]),
      pinned: asBoolean(memory["pinned"]),
      verified: asBoolean(memory["verified"]),
    })),
    openTasks: asRecordList(root["openTasks"]).map((task) => ({
      title: asString(task["title"], "(untitled)"),
      status: asString(task["status"], "open"),
      description: asString(task["description"]),
    })),
    openConflicts: asRecordList(root["openConflicts"]).map((conflict) => ({
      reason: asString(conflict["reason"], "Conflicting memory entries"),
      status: asString(conflict["status"], "open"),
    })),
    openHandoffs: asRecordList(root["openHandoffs"]).map((handoff) => ({
      summary: asString(handoff["summary"], "(no summary)"),
      details: asString(handoff["details"]),
      status: asString(handoff["status"], "open"),
    })),
    agents: asRecordList(root["agents"]).map((agent) => ({
      name: asString(agent["name"], "(unnamed)"),
      kind: asString(agent["kind"], "generic"),
      presence: asString(agent["presence"], "offline"),
      activity: asString(agent["activity"]),
    })),
  };
}

/** Rough token estimate: good enough to keep a brief inside a context window. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function clamp(text: string, max = MAX_BODY_CHARS): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`;
}

/** Stable sort that floats items matching `focus` to the top of their section. */
function rank<T>(items: readonly T[], focus: string | undefined, haystack: (item: T) => string): T[] {
  if (!focus) return [...items];
  const needle = focus.toLowerCase();
  const matches: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (haystack(item).toLowerCase().includes(needle)) matches.push(item);
    else rest.push(item);
  }
  return [...matches, ...rest];
}

type Section = { heading: string; blocks: string[] };

function assemble(header: string, sections: readonly Section[], budget: number | undefined): string {
  const parts: string[] = [header];
  let used = estimateTokens(header);
  let omitted = 0;

  for (const section of sections) {
    let headingWritten = false;
    for (const block of section.blocks) {
      const cost = estimateTokens(block) + (headingWritten ? 0 : estimateTokens(section.heading));
      if (budget !== undefined && used + cost > budget) {
        omitted += 1;
        continue;
      }
      if (!headingWritten) {
        parts.push(section.heading);
        headingWritten = true;
      }
      parts.push(block);
      used += cost;
    }
  }

  if (omitted > 0) {
    parts.push(`_Trimmed ${omitted} item${omitted === 1 ? "" : "s"} to stay near the ${budget}-token budget._`);
  }
  return `${parts.join("\n\n")}\n`;
}

/**
 * Client-side brief. Used when the API answers with JSON instead of markdown,
 * so `contextos brief` reads the same on old and new API builds.
 */
export function renderBriefMarkdown(pkg: ContextPackage, options: RenderOptions = {}): string {
  const { budget, focus } = options;
  const meta = [
    `${pkg.memories.length} memory ${pkg.memories.length === 1 ? "entry" : "entries"}`,
    `${pkg.openTasks.length} open task${pkg.openTasks.length === 1 ? "" : "s"}`,
    `${pkg.openConflicts.length} open conflict${pkg.openConflicts.length === 1 ? "" : "s"}`,
    `${pkg.agents.length} agent${pkg.agents.length === 1 ? "" : "s"}`,
  ];
  if (pkg.generatedAt) meta.push(`generated ${pkg.generatedAt}`);
  if (focus) meta.push(`focus "${focus}"`);

  const headerLines = [`# ${pkg.project.name} — ContextOS brief`, `_${meta.join(" · ")}_`];
  if (pkg.project.description.trim() !== "") headerLines.push(clamp(pkg.project.description, 400));

  const sections: Section[] = [
    {
      heading: "## Memory",
      blocks: rank(pkg.memories, focus, (memory) => `${memory.title} ${memory.body} ${memory.tags.join(" ")}`).map(
        (memory) => {
          const badges = [memory.type];
          if (memory.pinned) badges.push("pinned");
          badges.push(memory.verified ? "verified" : "unverified");
          const lines = [`### ${memory.title}`, `\`${badges.join(" · ")}\``, clamp(memory.body)];
          if (memory.tags.length > 0) lines.push(`Tags: ${memory.tags.join(", ")}`);
          return lines.join("\n");
        },
      ),
    },
    {
      heading: "## Open tasks",
      blocks: rank(pkg.openTasks, focus, (task) => `${task.title} ${task.description}`).map((task) => {
        const description = clamp(task.description, 240);
        return `- **${task.title}** \`${task.status}\`${description ? `\n  ${description}` : ""}`;
      }),
    },
    {
      heading: "## Open conflicts",
      blocks: pkg.openConflicts.map((conflict) => `- ${conflict.reason} \`${conflict.status}\``),
    },
    {
      heading: "## Open handoffs",
      blocks: pkg.openHandoffs.map((handoff) => {
        const details = clamp(handoff.details, 240);
        return `- **${handoff.summary}** \`${handoff.status}\`${details ? `\n  ${details}` : ""}`;
      }),
    },
    {
      heading: "## Agents",
      blocks: pkg.agents.map(
        (agent) => `- ${agent.name} (${agent.kind}) — ${agent.presence}${agent.activity ? `, ${agent.activity}` : ""}`,
      ),
    },
    {
      heading: "## Rules",
      blocks: [
        "- Humans verify memory. Agents must not mark entries verified.\n- If an open conflict touches your work, stop and hand off instead of guessing.",
      ],
    },
  ];

  return assemble(headerLines.join("\n\n"), sections, budget);
}
