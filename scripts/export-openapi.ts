import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../apps/api/src/app.js";
import { loadEnv } from "../apps/api/src/env.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  for (const file of [path.join(root, ".env"), path.join(process.cwd(), ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
    break;
  }
}

loadDotEnv();
process.env.NODE_ENV ??= "development";
process.env.DATABASE_URL ??= "postgresql://contextos:contextos@127.0.0.1:5432/contextos";
process.env.COOKIE_SECRET ??= "export-openapi-dev-secret-32chars-min!!";

const app = await buildApp(loadEnv());
const res = await app.inject({ method: "GET", url: "/api/docs/json" });
if (res.statusCode !== 200) {
  console.error("OpenAPI export failed:", res.statusCode, res.body);
  process.exit(1);
}
const out = path.join(root, "docs", "openapi.json");
writeFileSync(out, `${JSON.stringify(res.json(), null, 2)}\n`);
await app.close();
console.log(`Wrote ${out}`);
