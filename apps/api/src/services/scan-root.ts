import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");

/** Resolves a scan folder against cwd, then the repo root (API often runs from apps/api). */
export function resolveScanRoot(input: string): string {
  if (path.isAbsolute(input)) return input;
  const fromCwd = path.resolve(process.cwd(), input);
  if (existsSync(fromCwd)) return fromCwd;
  return path.resolve(REPO_ROOT, input);
}
