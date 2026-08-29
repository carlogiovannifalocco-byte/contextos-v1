import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const cliDir = path.join(root, "packages", "cli");
const tag = `v${version}`;
const tarball = `contextos-memory-${version}.tgz`;

function run(cmd, args, cwd = root) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run("npm", ["run", "build", "-w", "contextos-memory"]);
run("npm", ["pack"], cliDir);
run("gh", ["release", "upload", tag, tarball, "--clobber"], cliDir);

console.log(`\nUploaded ${tarball} to GitHub release ${tag}`);
