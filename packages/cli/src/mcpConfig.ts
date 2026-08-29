import { CliError } from "./errors.js";

/** One entry under `mcpServers`, shaped like the snippets in docs/MCP.md. */
export type McpServerEntry = {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
};

/** An `.mcp.json` / `.cursor/mcp.json` document. Unknown keys are preserved. */
export type McpConfigFile = Record<string, unknown> & { mcpServers: Record<string, unknown> };

export type McpServerConnection = {
  apiUrl?: string;
  agentKey?: string;
  projectId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => jsonEqual(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!jsonEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** Windows paths need forward slashes to survive a JSON round trip cleanly. */
export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function parseMcpConfig(raw: string, label: string): McpConfigFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new CliError(`${label} is not valid JSON. Fix or delete it, then run the command again.`);
  }
  if (!isRecord(parsed)) {
    throw new CliError(`${label} must contain a JSON object. Fix or delete it, then run the command again.`);
  }
  const servers = parsed["mcpServers"];
  if (servers !== undefined && !isRecord(servers)) {
    throw new CliError(`${label} has an "mcpServers" value that is not an object. Fix it, then run the command again.`);
  }
  return { ...parsed, mcpServers: isRecord(servers) ? servers : {} };
}

export function buildServerEntry(input: {
  contextosRoot: string;
  apiUrl: string;
  agentKey: string;
  projectId: string;
}): McpServerEntry {
  return {
    command: "npm",
    args: ["run", "mcp"],
    cwd: toPosixPath(input.contextosRoot),
    env: {
      CONTEXTOS_API_URL: input.apiUrl,
      CONTEXTOS_AGENT_KEY: input.agentKey,
      CONTEXTOS_PROJECT_ID: input.projectId,
    },
  };
}

/**
 * Merge our server into an existing config. Other servers, unknown top-level
 * keys, and extra keys on our own entry survive; re-running reports no change.
 */
export function mergeMcpServer(
  existing: McpConfigFile | undefined,
  name: string,
  entry: McpServerEntry,
): { config: McpConfigFile; changed: boolean } {
  const base: McpConfigFile = existing ?? { mcpServers: {} };
  const current = isRecord(base.mcpServers[name]) ? base.mcpServers[name] : undefined;
  const currentEnv = current && isRecord(current["env"]) ? current["env"] : {};
  const merged: Record<string, unknown> = {
    ...current,
    ...entry,
    env: { ...currentEnv, ...entry.env },
  };
  const config: McpConfigFile = {
    ...base,
    mcpServers: { ...base.mcpServers, [name]: merged },
  };
  return { config, changed: !jsonEqual(existing, config) };
}

/** Read back the connection an earlier `init` wrote, so other commands can reuse it. */
export function readServerConnection(config: unknown, name: string): McpServerConnection {
  if (!isRecord(config)) return {};
  const servers = config["mcpServers"];
  if (!isRecord(servers)) return {};
  const entry = servers[name];
  if (!isRecord(entry)) return {};
  const env = entry["env"];
  if (!isRecord(env)) return {};
  const pick = (key: string): string | undefined => {
    const value = env[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  };
  return {
    apiUrl: pick("CONTEXTOS_API_URL"),
    agentKey: pick("CONTEXTOS_AGENT_KEY"),
    projectId: pick("CONTEXTOS_PROJECT_ID"),
  };
}

/** Append only the missing entries, under a one-line explanation. */
export function appendGitignoreEntries(
  content: string,
  entries: readonly string[],
): { content: string; added: string[] } {
  const present = new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^\/+/, "").replace(/\/+$/, ""))
      .filter((line) => line !== ""),
  );
  const added = entries.filter((entry) => !present.has(entry.replace(/^\/+/, "")));
  if (added.length === 0) return { content, added };
  const base = content === "" || content.endsWith("\n") ? content : `${content}\n`;
  const separator = base === "" ? "" : "\n";
  const block = `${separator}# ContextOS: local MCP config, contains an agent key\n${added.join("\n")}\n`;
  return { content: `${base}${block}`, added };
}
