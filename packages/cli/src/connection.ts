import { CLI_NAME, DEFAULT_API_URL } from "./constants.js";
import { CliError } from "./errors.js";
import type { McpServerConnection } from "./mcpConfig.js";

export type ConnectionField = { value: string; source: string };

export type DiscoveredConnection = {
  apiUrl: ConnectionField;
  projectId?: ConnectionField;
  agentKey?: ConnectionField;
};

export type ResolvedConnection = {
  apiUrl: string;
  projectId: string;
  agentKey: string;
  sources: string[];
};

export type ConnectionInputs = {
  flags: { api?: string; project?: string; key?: string };
  env: McpServerConnection;
  files: ReadonlyArray<{ label: string; connection: McpServerConnection }>;
};

function first(...candidates: ReadonlyArray<ConnectionField | undefined>): ConnectionField | undefined {
  return candidates.find((candidate) => candidate !== undefined && candidate.value !== "");
}

function field(value: string | undefined, source: string): ConnectionField | undefined {
  return value === undefined || value.trim() === "" ? undefined : { value: value.trim(), source };
}

/**
 * Flags win, then environment variables, then the MCP config files that
 * `init` wrote, in the order they are passed in.
 */
export function resolveConnection(inputs: ConnectionInputs): DiscoveredConnection {
  const fromFiles = (pick: (connection: McpServerConnection) => string | undefined) =>
    inputs.files.map((file) => field(pick(file.connection), file.label));

  const apiUrl =
    first(
      field(inputs.flags.api, "--api"),
      field(inputs.env.apiUrl, "CONTEXTOS_API_URL"),
      ...fromFiles((connection) => connection.apiUrl),
    ) ?? { value: DEFAULT_API_URL, source: "default" };

  return {
    apiUrl,
    projectId: first(
      field(inputs.flags.project, "--project"),
      field(inputs.env.projectId, "CONTEXTOS_PROJECT_ID"),
      ...fromFiles((connection) => connection.projectId),
    ),
    agentKey: first(
      field(inputs.flags.key, "--key"),
      field(inputs.env.agentKey, "CONTEXTOS_AGENT_KEY"),
      ...fromFiles((connection) => connection.agentKey),
    ),
  };
}

/** Turn a partial discovery into a usable connection or one actionable error. */
export function requireConnection(discovered: DiscoveredConnection): ResolvedConnection {
  const missing: string[] = [];
  if (!discovered.projectId) missing.push("project id");
  if (!discovered.agentKey) missing.push("agent key");
  if (!discovered.projectId || !discovered.agentKey) {
    throw new CliError(
      `No ${missing.join(" or ")} found. Run "${CLI_NAME} init" here, or set CONTEXTOS_PROJECT_ID and CONTEXTOS_AGENT_KEY.`,
    );
  }
  const sources = [discovered.apiUrl.source, discovered.projectId.source, discovered.agentKey.source];
  return {
    apiUrl: discovered.apiUrl.value,
    projectId: discovered.projectId.value,
    agentKey: discovered.agentKey.value,
    sources: [...new Set(sources)],
  };
}
