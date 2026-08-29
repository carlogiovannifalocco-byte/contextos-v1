import { describe, expect, it } from "vitest";
import { parseInvocation } from "./args.js";
import { DEFAULT_API_URL } from "./constants.js";
import { CliError } from "./errors.js";

describe("parseInvocation", () => {
  it("shows help with no arguments", () => {
    expect(parseInvocation([])).toEqual({ kind: "help" });
  });

  it("shows command help for --help after a command", () => {
    expect(parseInvocation(["brief", "--help"])).toEqual({ kind: "help", topic: "brief" });
    expect(parseInvocation(["help", "init"])).toEqual({ kind: "help", topic: "init" });
  });

  it("reports the version", () => {
    expect(parseInvocation(["--version"]).kind).toBe("version");
    expect(parseInvocation(["-v"]).kind).toBe("version");
  });

  it("defaults init to the local API and interactive mode", () => {
    const invocation = parseInvocation(["init"]);
    expect(invocation).toEqual({
      kind: "init",
      options: {
        api: DEFAULT_API_URL,
        email: undefined,
        password: undefined,
        project: undefined,
        agent: undefined,
        mcpCwd: undefined,
        newKey: false,
        yes: false,
      },
    });
  });

  it("reads init flags", () => {
    const invocation = parseInvocation([
      "init",
      "--api",
      "http://127.0.0.1:3010",
      "--email",
      "demo@contextos.dev",
      "--project",
      "Atlas CLI",
      "--agent",
      "forge",
      "--new-key",
      "-y",
    ]);
    expect(invocation.kind === "init" && invocation.options).toMatchObject({
      api: "http://127.0.0.1:3010",
      email: "demo@contextos.dev",
      project: "Atlas CLI",
      agent: "forge",
      newKey: true,
      yes: true,
    });
  });

  it("keeps passwords verbatim, including surrounding spaces", () => {
    const invocation = parseInvocation(["init", "--password", " Demo Passw0rd! "]);
    expect(invocation.kind === "init" && invocation.options.password).toBe(" Demo Passw0rd! ");
  });

  it("defaults brief to markdown", () => {
    const invocation = parseInvocation(["brief"]);
    expect(invocation.kind === "brief" && invocation.options.format).toBe("md");
  });

  it("reads brief budget and focus", () => {
    const invocation = parseInvocation(["brief", "--format", "json", "--budget", "1200", "--focus", "auth"]);
    expect(invocation.kind === "brief" && invocation.options).toMatchObject({
      format: "json",
      budget: 1200,
      focus: "auth",
    });
  });

  it("rejects a non-numeric budget", () => {
    expect(() => parseInvocation(["brief", "--budget", "lots"])).toThrow(CliError);
    expect(() => parseInvocation(["brief", "--budget", "0"])).toThrow(/positive whole number/);
  });

  it("rejects an unsupported format", () => {
    expect(() => parseInvocation(["brief", "--format", "yaml"])).toThrow(/"md" or "json"/);
  });

  it("rejects unknown commands and flags with one actionable line", () => {
    expect(() => parseInvocation(["deploy"])).toThrow(/Unknown command "deploy"/);
    expect(() => parseInvocation(["status", "--budget", "10"])).toThrow(CliError);
    expect(() => parseInvocation(["--api", "http://x"])).toThrow(/options come after a command/);
  });

  it("does not accept positional arguments after a command", () => {
    expect(() => parseInvocation(["status", "extra"])).toThrow(CliError);
  });
});
