#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = process.env.CONTEXTOS_API_URL ?? "http://localhost:3001";
const KEY = process.env.CONTEXTOS_AGENT_KEY ?? "";
const PROJECT = process.env.CONTEXTOS_PROJECT_ID ?? "";

async function request(path: string, init: RequestInit = {}) {
  if (!KEY) throw new Error("CONTEXTOS_AGENT_KEY is required (cos_…)");
  if (!PROJECT) throw new Error("CONTEXTOS_PROJECT_ID is required");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ContextOS ${res.status}: ${text.slice(0, 400)}`);
  }
  return text;
}

async function api(path: string, init: RequestInit = {}) {
  const text = await request(path, init);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function asText(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function asMarkdown(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const server = new McpServer({
  name: "contextos",
  version: "1.0.0-beta",
});

function contextQuery(budget?: number, focus?: string, format?: "json" | "md") {
  const params = new URLSearchParams();
  if (budget !== undefined) params.set("budget", String(budget));
  if (focus) params.set("focus", focus);
  if (format) params.set("format", format);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

server.tool(
  "get_brief",
  "START HERE. Returns a ready-to-read markdown brief of everything already decided on this project: hard constraints, decisions, conventions, open conflicts, tasks and who else is working. Superseded decisions are excluded and the result is packed into a token budget. Pass `focus` with your current task to pull the most relevant memory to the top.",
  {
    focus: z.string().optional(),
    budget: z.number().int().min(200).max(32_000).optional(),
  },
  async ({ focus, budget }) =>
    asMarkdown(await request(`/api/v1/projects/${PROJECT}/context-package${contextQuery(budget, focus, "md")}`)),
);

server.tool(
  "get_context_package",
  "Same compiled context as get_brief but as structured JSON, including per-entry scores, what was omitted for budget, and which entries are superseded. Prefer get_brief unless you need the fields.",
  {
    focus: z.string().optional(),
    budget: z.number().int().min(200).max(32_000).optional(),
  },
  async ({ focus, budget }) =>
    asText(await api(`/api/v1/projects/${PROJECT}/context-package${contextQuery(budget, focus, "json")}`)),
);

server.tool(
  "search_memory",
  "Search shared memory. Prefer this before inventing project conventions.",
  { q: z.string().optional(), type: z.string().optional() },
  async ({ q, type }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    return asText(await api(`/api/v1/projects/${PROJECT}/memory?${params}`));
  },
);

server.tool(
  "write_memory",
  "Write a memory entry. Humans verify; do not claim verification. Types: decision, convention, fact, note, constraint, risk.",
  {
    type: z.enum(["decision", "convention", "fact", "note", "constraint", "risk"]),
    title: z.string(),
    body: z.string(),
    tags: z.array(z.string()).optional(),
  },
  async (input) => asText(await api(`/api/v1/projects/${PROJECT}/memory`, { method: "POST", body: JSON.stringify(input) })),
);

server.tool(
  "supersede_memory",
  "Replace an outdated decision. Write the new entry first, then call this with the new id and the id it replaces. The old entry is archived and stops appearing in briefs, so use this instead of leaving two contradictory entries behind.",
  {
    newMemoryId: z.string(),
    supersedesMemoryId: z.string(),
    note: z.string().optional(),
  },
  async ({ newMemoryId, supersedesMemoryId, note }) =>
    asText(
      await api(`/api/v1/memory/${newMemoryId}/relations`, {
        method: "POST",
        body: JSON.stringify({ toId: supersedesMemoryId, kind: "supersedes", note }),
      }),
    ),
);

server.tool(
  "link_memory",
  "Link two memory entries so the shared brain keeps its shape. Kinds: contradicts (flag a disagreement for a human), references (related reading), parent_of (this entry breaks down into that one). Use supersede_memory to replace an outdated decision.",
  {
    fromMemoryId: z.string(),
    toMemoryId: z.string(),
    kind: z.enum(["contradicts", "references", "parent_of"]),
    note: z.string().optional(),
  },
  async ({ fromMemoryId, toMemoryId, kind, note }) =>
    asText(
      await api(`/api/v1/memory/${fromMemoryId}/relations`, {
        method: "POST",
        body: JSON.stringify({ toId: toMemoryId, kind, note }),
      }),
    ),
);

server.tool(
  "get_memory_relations",
  "Show what a memory entry supersedes, contradicts, or references, and what points at it.",
  { memoryId: z.string() },
  async ({ memoryId }) => asText(await api(`/api/v1/memory/${memoryId}/relations`)),
);

server.tool(
  "list_tasks",
  "List project tasks (Kanban statuses: open, in_progress, blocked, done).",
  {},
  async () => asText(await api(`/api/v1/projects/${PROJECT}/tasks`)),
);

server.tool(
  "create_task",
  "Create a task in the shared board.",
  {
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["open", "in_progress", "blocked", "done"]).optional(),
    assigneeAgentId: z.string().optional(),
  },
  async (input) => asText(await api(`/api/v1/projects/${PROJECT}/tasks`, { method: "POST", body: JSON.stringify(input) })),
);

server.tool(
  "update_task",
  "Update a task status or assignment.",
  {
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["open", "in_progress", "blocked", "done"]).optional(),
    assigneeAgentId: z.string().nullable().optional(),
  },
  async ({ id, ...patch }) => asText(await api(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) })),
);

server.tool(
  "heartbeat",
  "Tell ContextOS this agent is alive. Call periodically.",
  { activity: z.string().optional(), agentId: z.string() },
  async ({ agentId, activity }) =>
    asText(await api(`/api/v1/agents/${agentId}/heartbeat`, { method: "POST", body: JSON.stringify({ activity }) })),
);

server.tool(
  "set_presence",
  "Set presence: online, idle, or offline.",
  {
    agentId: z.string(),
    presence: z.enum(["online", "idle", "offline"]),
    activity: z.string().optional(),
  },
  async ({ agentId, ...body }) =>
    asText(await api(`/api/v1/agents/${agentId}/presence`, { method: "PATCH", body: JSON.stringify(body) })),
);

server.tool(
  "list_events",
  "Recent project activity events.",
  {},
  async () => asText(await api(`/api/v1/projects/${PROJECT}/events`)),
);

server.tool(
  "list_handoffs",
  "List agent handoffs.",
  {},
  async () => asText(await api(`/api/v1/projects/${PROJECT}/handoffs`)),
);

server.tool(
  "create_handoff",
  "Leave a handoff for another agent.",
  {
    summary: z.string(),
    details: z.string().optional(),
    toAgentId: z.string().optional(),
    fromAgentId: z.string().optional(),
  },
  async (input) =>
    asText(await api(`/api/v1/projects/${PROJECT}/handoffs`, { method: "POST", body: JSON.stringify(input) })),
);

server.tool(
  "detect_conflicts",
  "Read or re-run lexical conflict detection. Do not resolve conflicts; humans merge.",
  {},
  async () => asText(await api(`/api/v1/projects/${PROJECT}/conflicts/detect`, { method: "POST", body: "{}" })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
