import { describe, expect, it } from "vitest";
import { CliError } from "./errors.js";
import {
  appendGitignoreEntries,
  buildServerEntry,
  mergeMcpServer,
  parseMcpConfig,
  readServerConnection,
  toPosixPath,
  type McpConfigFile,
} from "./mcpConfig.js";

const entry = buildServerEntry({
  contextosRoot: "C:\\Users\\dev\\ContextOS",
  apiUrl: "http://127.0.0.1:3010",
  agentKey: "cos_abcdefghijklmnopqrstuvwxyz",
  projectId: "cmproject123",
});

describe("buildServerEntry", () => {
  it("matches the documented npm run mcp shape", () => {
    expect(entry).toEqual({
      command: "npm",
      args: ["run", "mcp"],
      cwd: "C:/Users/dev/ContextOS",
      env: {
        CONTEXTOS_API_URL: "http://127.0.0.1:3010",
        CONTEXTOS_AGENT_KEY: "cos_abcdefghijklmnopqrstuvwxyz",
        CONTEXTOS_PROJECT_ID: "cmproject123",
      },
    });
  });

  it("normalizes Windows paths for JSON", () => {
    expect(toPosixPath("C:\\a\\b")).toBe("C:/a/b");
  });
});

describe("mergeMcpServer", () => {
  it("creates the file content when nothing exists yet", () => {
    const { config, changed } = mergeMcpServer(undefined, "contextos", entry);
    expect(changed).toBe(true);
    expect(config.mcpServers["contextos"]).toEqual(entry);
  });

  it("is idempotent: a second merge reports no change", () => {
    const first = mergeMcpServer(undefined, "contextos", entry);
    const second = mergeMcpServer(first.config, "contextos", entry);
    expect(second.changed).toBe(false);
    expect(second.config).toEqual(first.config);
    expect(Object.keys(second.config.mcpServers)).toEqual(["contextos"]);
  });

  it("keeps other servers and unrelated top-level keys", () => {
    const existing: McpConfigFile = {
      $schema: "https://example.com/mcp.json",
      mcpServers: {
        filesystem: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
      },
    };
    const { config, changed } = mergeMcpServer(existing, "contextos", entry);
    expect(changed).toBe(true);
    expect(config["$schema"]).toBe("https://example.com/mcp.json");
    expect(config.mcpServers["filesystem"]).toEqual(existing.mcpServers["filesystem"]);
    expect(Object.keys(config.mcpServers).sort()).toEqual(["contextos", "filesystem"]);
  });

  it("refreshes our env while keeping extra keys the user added", () => {
    const existing: McpConfigFile = {
      mcpServers: {
        contextos: {
          command: "npm",
          args: ["run", "mcp"],
          cwd: "C:/old/checkout",
          disabled: false,
          env: { CONTEXTOS_API_URL: "http://127.0.0.1:3001", CONTEXTOS_AGENT_KEY: "cos_old", NODE_OPTIONS: "--no-warnings" },
        },
      },
    };
    const { config, changed } = mergeMcpServer(existing, "contextos", entry);
    expect(changed).toBe(true);
    expect(config.mcpServers["contextos"]).toEqual({
      command: "npm",
      args: ["run", "mcp"],
      cwd: "C:/Users/dev/ContextOS",
      disabled: false,
      env: { ...entry.env, NODE_OPTIONS: "--no-warnings" },
    });
  });
});

describe("parseMcpConfig", () => {
  it("adds a missing mcpServers object", () => {
    expect(parseMcpConfig("{}", ".mcp.json").mcpServers).toEqual({});
  });

  it("refuses to guess at broken files", () => {
    expect(() => parseMcpConfig("{ not json", ".mcp.json")).toThrow(CliError);
    expect(() => parseMcpConfig("[]", ".mcp.json")).toThrow(/must contain a JSON object/);
    expect(() => parseMcpConfig('{"mcpServers":3}', ".mcp.json")).toThrow(/not an object/);
  });
});

describe("readServerConnection", () => {
  it("reads back what init wrote", () => {
    const { config } = mergeMcpServer(undefined, "contextos", entry);
    expect(readServerConnection(config, "contextos")).toEqual({
      apiUrl: "http://127.0.0.1:3010",
      agentKey: "cos_abcdefghijklmnopqrstuvwxyz",
      projectId: "cmproject123",
    });
  });

  it("returns nothing for foreign or malformed config", () => {
    expect(readServerConnection({ mcpServers: { other: { command: "x" } } }, "contextos")).toEqual({});
    expect(readServerConnection("nope", "contextos")).toEqual({});
  });
});

describe("appendGitignoreEntries", () => {
  it("appends only what is missing", () => {
    const result = appendGitignoreEntries("node_modules\n", [".mcp.json", ".cursor/mcp.json"]);
    expect(result.added).toEqual([".mcp.json", ".cursor/mcp.json"]);
    expect(result.content).toBe(
      "node_modules\n\n# ContextOS: local MCP config, contains an agent key\n.mcp.json\n.cursor/mcp.json\n",
    );
  });

  it("is idempotent", () => {
    const once = appendGitignoreEntries("node_modules\n", [".mcp.json", ".cursor/mcp.json"]);
    const twice = appendGitignoreEntries(once.content, [".mcp.json", ".cursor/mcp.json"]);
    expect(twice.added).toEqual([]);
    expect(twice.content).toBe(once.content);
  });

  it("ignores leading and trailing slashes when comparing", () => {
    const result = appendGitignoreEntries("/.mcp.json\n.cursor/mcp.json/\n", [".mcp.json", ".cursor/mcp.json"]);
    expect(result.added).toEqual([]);
  });

  it("adds the missing newline before appending", () => {
    const result = appendGitignoreEntries("dist", [".mcp.json"]);
    expect(result.content.startsWith("dist\n\n#")).toBe(true);
  });
});
