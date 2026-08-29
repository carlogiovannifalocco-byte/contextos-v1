// Mirrors packages/shared/src/constants.ts on purpose: the CLI ships with zero
// runtime dependencies so it can run from a plain `node dist/index.js` outside
// this workspace. Keep the values in sync with the API.
export const CLI_NAME = "contextos";
export const CLI_VERSION = "1.0.0-beta";
export const AGENT_KEY_PREFIX = "cos_";
export const CSRF_HEADER = "x-csrf-token";

export const DEFAULT_API_URL = "http://127.0.0.1:3001";
export const MCP_SERVER_NAME = "contextos";
export const CLAUDE_MCP_FILE = ".mcp.json";
export const CURSOR_MCP_FILE = ".cursor/mcp.json";
export const IGNORE_FILE = ".contextosignore";

// Same list the API seeds into IgnoreRules.content (packages/db/prisma/schema.prisma).
export const DEFAULT_IGNORE_CONTENT = "node_modules\n.git\ndist\nbuild\n.env\ncoverage\n";
