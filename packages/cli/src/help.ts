import type { CommandName } from "./args.js";
import { CLAUDE_MCP_FILE, CLI_NAME, CLI_VERSION, CURSOR_MCP_FILE, DEFAULT_API_URL, IGNORE_FILE } from "./constants.js";

const GENERAL = `${CLI_NAME} ${CLI_VERSION} — shared memory for AI coding agents

Usage
  ${CLI_NAME} <command> [options]

Commands
  init      Connect this folder to ContextOS and write MCP config
  status    Show API reachability, project counts, conflicts, and agent presence
  brief     Print the project context package for a human or an agent

Options
  -h, --help      Show this help, or "${CLI_NAME} <command> --help"
  -v, --version   Print the version

Environment
  CONTEXTOS_API_URL      API base URL (default ${DEFAULT_API_URL})
  CONTEXTOS_PROJECT_ID   Project id for status and brief
  CONTEXTOS_AGENT_KEY    Agent key (cos_…) for status and brief
  CONTEXTOS_DEBUG=1      Also print the stack trace when something fails`;

const INIT = `${CLI_NAME} init — connect this folder to ContextOS

Checks the API, signs you in (or registers you), picks or creates a project,
registers an agent, and writes ${CLAUDE_MCP_FILE}, ${CURSOR_MCP_FILE}, and ${IGNORE_FILE}.
Re-running is safe: other MCP servers are preserved and a working key is reused.

Usage
  ${CLI_NAME} init [options]

Options
  --api <url>        API base URL (default ${DEFAULT_API_URL})
  --email <email>    Account email
  --password <text>  Account password (prompted when omitted)
  --project <name>   Project to use; created when no project has that name
  --agent <name>     Name for the agent to register
  --mcp-cwd <path>   ContextOS checkout that runs "npm run mcp"
  --new-key          Register a new agent even if this folder already has a working key
  -y, --yes          Never prompt; fail with a clear message instead`;

const STATUS = `${CLI_NAME} status — is the shared brain reachable and busy?

Reads the connection from flags, then CONTEXTOS_* variables, then
${CLAUDE_MCP_FILE} / ${CURSOR_MCP_FILE} in the current folder.

Usage
  ${CLI_NAME} status [options]

Options
  --api <url>        API base URL
  --project <id>     Project id
  --key <cos_…>      Agent key`;

const BRIEF = `${CLI_NAME} brief — print the project context package

Asks the API for a markdown brief. Against an API that only returns JSON,
the same brief is rendered locally, so the output is readable either way.

Usage
  ${CLI_NAME} brief [options]

Options
  --format <md|json>  Output format (default md)
  --budget <tokens>   Rough token ceiling; lower-value items are trimmed
  --focus <text>      Float memory and tasks matching this text to the top
  --api <url>         API base URL
  --project <id>      Project id
  --key <cos_…>       Agent key`;

const TOPICS: Record<CommandName, string> = { init: INIT, status: STATUS, brief: BRIEF };

export function helpText(topic?: CommandName): string {
  return topic === undefined ? GENERAL : TOPICS[topic];
}
