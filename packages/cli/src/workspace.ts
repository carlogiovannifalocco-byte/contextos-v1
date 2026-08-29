import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLI_NAME } from "./constants.js";
import { CliError } from "./errors.js";

const CONNECTOR_ENTRY = path.join("connectors", "mcp", "src", "index.ts");

export function readTextIfExists(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new CliError(`Cannot read ${file}: ${cause}`);
  }
}

export function writeTextFile(file: string, content: string): void {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content, "utf8");
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new CliError(`Cannot write ${file}: ${cause}`);
  }
}

export function writeJsonFile(file: string, value: unknown): void {
  writeTextFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isContextosCheckout(dir: string): boolean {
  return existsSync(path.join(dir, CONNECTOR_ENTRY)) && existsSync(path.join(dir, "package.json"));
}

function ascend(start: string): string | undefined {
  let current = path.resolve(start);
  for (;;) {
    if (isContextosCheckout(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * The MCP entry in the config files runs `npm run mcp` from a ContextOS
 * checkout, so `init` has to know where that checkout lives.
 */
export function resolveContextosRoot(override: string | undefined, cwd: string): string {
  if (override !== undefined) {
    const resolved = path.resolve(cwd, override);
    if (!isContextosCheckout(resolved)) {
      throw new CliError(`No ContextOS checkout at ${resolved} (expected ${CONNECTOR_ENTRY}).`);
    }
    return resolved;
  }
  const fromCli = ascend(path.dirname(fileURLToPath(import.meta.url)));
  if (fromCli) return fromCli;
  const fromCwd = ascend(cwd);
  if (fromCwd) return fromCwd;
  throw new CliError(
    `Could not find a ContextOS checkout. Run "${CLI_NAME} init --mcp-cwd <path-to-contextos-repo>".`,
  );
}
