import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function loadDotEnv() {
  if (process.env.CONTEXTOS_TEST_IGNORE_DOTENV === "1") return;
  const envFile = path.join(repoRoot, ".env");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL?.trim()) {
  process.env.CONTEXTOS_SKIP_DB_TESTS = "1";
  const g = globalThis as typeof globalThis & { __contextosDbSkipMsg?: boolean };
  if (!g.__contextosDbSkipMsg) {
    g.__contextosDbSkipMsg = true;
    console.error(
      "\nContextOS: DATABASE_URL is not set. Skipping API integration tests (they need Postgres).\n" +
        "Run `node scripts/setup.mjs` (writes .env) or export DATABASE_URL.\n" +
        "Unit tests that do not need the database still run. See docs/QUICKSTART.md.\n",
    );
  }
}
