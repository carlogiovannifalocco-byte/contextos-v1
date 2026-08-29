import { describe, expect, it } from "vitest";
import { requireConnection, resolveConnection, type ConnectionInputs } from "./connection.js";
import { DEFAULT_API_URL } from "./constants.js";
import { CliError } from "./errors.js";

const fileConnection = {
  label: ".mcp.json",
  connection: { apiUrl: "http://127.0.0.1:3010", agentKey: "cos_fromfile", projectId: "cmfromfile" },
};

function inputs(overrides: Partial<ConnectionInputs> = {}): ConnectionInputs {
  return { flags: {}, env: {}, files: [], ...overrides };
}

describe("resolveConnection", () => {
  it("falls back to the local default API", () => {
    const resolved = resolveConnection(inputs());
    expect(resolved.apiUrl).toEqual({ value: DEFAULT_API_URL, source: "default" });
    expect(resolved.projectId).toBeUndefined();
  });

  it("prefers flags, then environment, then config files", () => {
    const resolved = resolveConnection(
      inputs({
        flags: { api: "http://flag:1" },
        env: { apiUrl: "http://env:2", projectId: "cmfromenv" },
        files: [fileConnection],
      }),
    );
    expect(resolved.apiUrl?.value).toBe("http://flag:1");
    expect(resolved.projectId).toEqual({ value: "cmfromenv", source: "CONTEXTOS_PROJECT_ID" });
    expect(resolved.agentKey).toEqual({ value: "cos_fromfile", source: ".mcp.json" });
  });

  it("skips empty values instead of treating them as answers", () => {
    const resolved = resolveConnection(inputs({ env: { agentKey: "  " }, files: [fileConnection] }));
    expect(resolved.agentKey?.source).toBe(".mcp.json");
  });
});

describe("requireConnection", () => {
  it("returns the resolved trio and the sources it used", () => {
    const resolved = requireConnection(resolveConnection(inputs({ files: [fileConnection] })));
    expect(resolved).toEqual({
      apiUrl: "http://127.0.0.1:3010",
      projectId: "cmfromfile",
      agentKey: "cos_fromfile",
      sources: [".mcp.json"],
    });
  });

  it("names what is missing in one actionable line", () => {
    expect(() => requireConnection(resolveConnection(inputs()))).toThrow(CliError);
    expect(() => requireConnection(resolveConnection(inputs()))).toThrow(
      /No project id or agent key found\. Run "contextos init"/,
    );
  });
});
