import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "packages", "cli");

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

console.log("Building CLI…");
run("npm", ["run", "build", "-w", "contextos-memory"], root);

console.log("\nPack dry-run (files that would ship to npm):\n");
run("npm", ["pack", "--dry-run"], cli);

console.log("\nTo publish: cd packages/cli && npm publish --access public --tag beta");
console.log("See docs/NPM.md");
