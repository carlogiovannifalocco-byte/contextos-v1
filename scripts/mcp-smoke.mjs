import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");
const entry = path.join(root, "connectors/mcp/src/index.ts");

const payload =
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "contextos-mcp-smoke", version: "1.0.0-beta" },
    },
  }) + "\n";

const child = spawn(process.execPath, [tsxCli, entry], {
  cwd: root,
  env: {
    ...process.env,
    CONTEXTOS_API_URL: process.env.CONTEXTOS_API_URL ?? "http://127.0.0.1:3001",
    CONTEXTOS_AGENT_KEY: process.env.CONTEXTOS_AGENT_KEY ?? "cos_smoke_placeholder_not_a_real_key",
    CONTEXTOS_PROJECT_ID: process.env.CONTEXTOS_PROJECT_ID ?? "clxxxxxxxxxxxxxxxxxxxxxx",
  },
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let out = "";
let err = "";
let settled = false;

function fail(reason) {
  if (settled) return;
  settled = true;
  child.kill();
  console.error(reason);
  if (err.trim()) console.error(err.slice(0, 2000));
  if (out.trim()) console.error("stdout:", out.slice(0, 500));
  process.exit(1);
}

function ok() {
  if (settled) return;
  settled = true;
  child.kill();
  console.log("MCP stdio initialize: ok");
  process.exit(0);
}

const timer = setTimeout(() => fail("MCP smoke timed out waiting for initialize."), 20_000);

child.stdout.on("data", (chunk) => {
  out += chunk.toString();
  if (/protocolVersion|"result"|serverInfo|"contextos"/i.test(out)) {
    clearTimeout(timer);
    ok();
  }
});
child.stderr.on("data", (chunk) => {
  err += chunk.toString();
});
child.on("error", (e) => fail(e.message));
child.on("exit", (code) => {
  if (!settled && code && code !== 0) fail(`MCP process exited ${code}`);
});

setTimeout(() => {
  child.stdin.write(payload);
}, 1200);
