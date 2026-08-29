import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const version = readJson("package.json").version;
const cliPkg = readJson("packages/cli/package.json").version;
const constants = readFileSync(path.join(root, "packages/cli/src/constants.ts"), "utf8");
const appVersion = readFileSync(path.join(root, "packages/shared/src/constants.ts"), "utf8");

const mismatches = [];
if (cliPkg !== version) mismatches.push(`packages/cli (${cliPkg}) vs root (${version})`);
if (!constants.includes(`CLI_VERSION = "${version}"`)) mismatches.push("packages/cli/src/constants.ts CLI_VERSION");
if (!appVersion.includes(`APP_VERSION = "${version}"`)) mismatches.push("packages/shared/src/constants.ts APP_VERSION");

if (mismatches.length) {
  console.error("Version mismatch:\n - " + mismatches.join("\n - "));
  process.exit(1);
}

console.log(`Release prep for ${version}\n`);
run("npm", ["run", "verify:full"]);
run("npm", ["run", "test:e2e"]);
run("node", ["scripts/pack-cli.mjs"]);

console.log(`
✓ Ready for release ${version}

Next steps (manual):
  1. git add -A && git commit -m "ContextOS ${version}"
  2. git tag -a v${version} -m "ContextOS ${version}"
  3. git push origin main --tags
  4. gh release create v${version} --title "ContextOS ${version}" --notes-file docs/releases/v${version}.md
  5. cd packages/cli && npm publish --access public --tag beta

Notes:
  - Repo has no remote yet? Add one first (see docs/RELEASE.md).
  - npm package name: contextos-memory (not @contextos/cli — taken on npm).
`);
