import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", ".prisma", "client");
const targets = [
  path.join(root, "packages", "db", "node_modules", ".prisma", "client"),
];

if (!existsSync(source)) {
  console.error("Missing generated client at", source);
  console.error("Run: npm run generate -w @contextos/db");
  process.exit(1);
}

for (const target of targets) {
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  console.log("Synced Prisma client →", path.relative(root, target));
}
