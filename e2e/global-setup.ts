import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    console.log("e2e global-setup: DATABASE_URL unset — skipping db:seed");
    return;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  console.log("e2e global-setup: seeding demo data…");
  execSync("npm run db:seed", { cwd: root, stdio: "inherit", env: process.env });
}
