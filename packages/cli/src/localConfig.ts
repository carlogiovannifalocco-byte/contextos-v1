import path from "node:path";
import { resolveConnection, type DiscoveredConnection } from "./connection.js";
import {
  CLAUDE_MCP_FILE,
  CURSOR_MCP_FILE,
  DEFAULT_IGNORE_CONTENT,
  IGNORE_FILE,
  MCP_SERVER_NAME,
} from "./constants.js";
import {
  appendGitignoreEntries,
  mergeMcpServer,
  parseMcpConfig,
  readServerConnection,
  type McpServerConnection,
  type McpServerEntry,
} from "./mcpConfig.js";
import { readTextIfExists, writeJsonFile, writeTextFile } from "./workspace.js";

export type ConfigTarget = { label: string; file: string };
export type WriteResult = { label: string; changed: boolean };

/** Claude Code reads `.mcp.json`; Cursor reads `.cursor/mcp.json`. Same shape. */
export function mcpConfigTargets(cwd: string): ConfigTarget[] {
  return [
    { label: CLAUDE_MCP_FILE, file: path.join(cwd, CLAUDE_MCP_FILE) },
    { label: CURSOR_MCP_FILE, file: path.join(cwd, ".cursor", "mcp.json") },
  ];
}

export function readLocalConnections(cwd: string): Array<{ label: string; connection: McpServerConnection }> {
  const found: Array<{ label: string; connection: McpServerConnection }> = [];
  for (const target of mcpConfigTargets(cwd)) {
    const raw = readTextIfExists(target.file);
    if (raw === undefined) continue;
    found.push({
      label: target.label,
      connection: readServerConnection(parseMcpConfig(raw, target.label), MCP_SERVER_NAME),
    });
  }
  return found;
}

/** Where `status` and `brief` look for a connection: flags, env, then config files. */
export function discoverConnection(
  flags: { api?: string; project?: string; key?: string },
  cwd: string,
): DiscoveredConnection {
  return resolveConnection({
    flags,
    env: {
      apiUrl: process.env["CONTEXTOS_API_URL"],
      agentKey: process.env["CONTEXTOS_AGENT_KEY"],
      projectId: process.env["CONTEXTOS_PROJECT_ID"],
    },
    files: readLocalConnections(cwd),
  });
}

/** Merge our server into both files, leaving untouched files byte-identical. */
export function writeMcpConfigs(cwd: string, entry: McpServerEntry): WriteResult[] {
  return mcpConfigTargets(cwd).map((target) => {
    const raw = readTextIfExists(target.file);
    const existing = raw === undefined ? undefined : parseMcpConfig(raw, target.label);
    const { config, changed } = mergeMcpServer(existing, MCP_SERVER_NAME, entry);
    if (changed) writeJsonFile(target.file, config);
    return { label: target.label, changed };
  });
}

export function ensureIgnoreFile(cwd: string): WriteResult {
  const file = path.join(cwd, IGNORE_FILE);
  if (readTextIfExists(file) !== undefined) return { label: IGNORE_FILE, changed: false };
  writeTextFile(file, DEFAULT_IGNORE_CONTENT);
  return { label: IGNORE_FILE, changed: true };
}

/** Only touches an existing .gitignore; creating one is the repo owner's call. */
export function protectMcpFilesInGitignore(cwd: string): { present: boolean; added: string[] } {
  const file = path.join(cwd, ".gitignore");
  const content = readTextIfExists(file);
  if (content === undefined) return { present: false, added: [] };
  const result = appendGitignoreEntries(content, [CLAUDE_MCP_FILE, CURSOR_MCP_FILE]);
  if (result.added.length > 0) writeTextFile(file, result.content);
  return { present: true, added: result.added };
}
