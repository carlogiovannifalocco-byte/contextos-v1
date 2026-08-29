import { parseArgs } from "node:util";
import { CLI_NAME, DEFAULT_API_URL } from "./constants.js";
import { CliError } from "./errors.js";

export const COMMANDS = ["init", "status", "brief"] as const;
export type CommandName = (typeof COMMANDS)[number];

export type BriefFormat = "md" | "json";

export type InitOptions = {
  api: string;
  email?: string;
  password?: string;
  project?: string;
  agent?: string;
  mcpCwd?: string;
  newKey: boolean;
  yes: boolean;
};

export type StatusOptions = {
  api?: string;
  project?: string;
  key?: string;
};

export type BriefOptions = StatusOptions & {
  format: BriefFormat;
  budget?: number;
  focus?: string;
};

export type Invocation =
  | { kind: "help"; topic?: CommandName }
  | { kind: "version" }
  | { kind: "init"; options: InitOptions }
  | { kind: "status"; options: StatusOptions }
  | { kind: "brief"; options: BriefOptions };

type OptionMap = Record<string, { type: "string" | "boolean"; short?: string }>;

const CONNECTION_OPTIONS: OptionMap = {
  api: { type: "string" },
  project: { type: "string" },
  key: { type: "string" },
};

const INIT_OPTIONS: OptionMap = {
  api: { type: "string" },
  email: { type: "string" },
  password: { type: "string" },
  project: { type: "string" },
  agent: { type: "string" },
  "mcp-cwd": { type: "string" },
  "new-key": { type: "boolean" },
  yes: { type: "boolean", short: "y" },
};

const BRIEF_OPTIONS: OptionMap = {
  ...CONNECTION_OPTIONS,
  format: { type: "string" },
  budget: { type: "string" },
  focus: { type: "string" },
};

function isCommandName(value: string | undefined): value is CommandName {
  return COMMANDS.some((command) => command === value);
}

function values(args: string[], options: OptionMap): Record<string, unknown> {
  try {
    const parsed = parseArgs({ args, options, strict: true, allowPositionals: false });
    return parsed.values as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`${message} Run "${CLI_NAME} --help" to see the supported flags.`);
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function flag(value: unknown): boolean {
  return value === true;
}

function positiveInt(value: unknown, flagName: string): number | undefined {
  const raw = text(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`--${flagName} expects a positive whole number, got "${raw}".`);
  }
  return parsed;
}

function briefFormat(value: unknown): BriefFormat {
  const raw = text(value) ?? "md";
  if (raw !== "md" && raw !== "json") {
    throw new CliError(`--format expects "md" or "json", got "${raw}".`);
  }
  return raw;
}

function connectionOptions(parsed: Record<string, unknown>): StatusOptions {
  return {
    api: text(parsed["api"]),
    project: text(parsed["project"]),
    key: text(parsed["key"]),
  };
}

/** Turn `process.argv.slice(2)` into a validated invocation. Throws CliError on bad input. */
export function parseInvocation(argv: readonly string[]): Invocation {
  const first = argv[0];
  if (first === undefined || first === "--help" || first === "-h" || first === "help") {
    const topic = first === "help" ? argv[1] : undefined;
    if (topic !== undefined && !isCommandName(topic)) {
      throw new CliError(`No help for "${topic}". Known commands: ${COMMANDS.join(", ")}.`);
    }
    return isCommandName(topic) ? { kind: "help", topic } : { kind: "help" };
  }
  if (first === "--version" || first === "-v" || first === "-V") {
    return { kind: "version" };
  }
  if (!isCommandName(first)) {
    const hint = first.startsWith("-") ? "options come after a command" : `known commands: ${COMMANDS.join(", ")}`;
    throw new CliError(`Unknown command "${first}" (${hint}). Run "${CLI_NAME} --help".`);
  }

  const rest = argv.slice(1);
  if (rest.includes("--help") || rest.includes("-h")) {
    return { kind: "help", topic: first };
  }

  if (first === "init") {
    const parsed = values(rest, INIT_OPTIONS);
    return {
      kind: "init",
      options: {
        api: text(parsed["api"]) ?? DEFAULT_API_URL,
        email: text(parsed["email"]),
        password: typeof parsed["password"] === "string" ? parsed["password"] : undefined,
        project: text(parsed["project"]),
        agent: text(parsed["agent"]),
        mcpCwd: text(parsed["mcp-cwd"]),
        newKey: flag(parsed["new-key"]),
        yes: flag(parsed["yes"]),
      },
    };
  }

  if (first === "status") {
    return { kind: "status", options: connectionOptions(values(rest, CONNECTION_OPTIONS)) };
  }

  const parsed = values(rest, BRIEF_OPTIONS);
  return {
    kind: "brief",
    options: {
      ...connectionOptions(parsed),
      format: briefFormat(parsed["format"]),
      budget: positiveInt(parsed["budget"], "budget"),
      focus: text(parsed["focus"]),
    },
  };
}
