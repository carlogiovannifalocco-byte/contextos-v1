import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32", ...opts });
    child.on("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`${cmd} failed (${code})`))));
  });
}

function runCapture(cmd, args) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(cmd, args, { cwd: root, shell: process.platform === "win32" });
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("exit", (code) => resolve({ code: code ?? 1, text: Buffer.concat(chunks).toString("utf8") }));
  });
}

function toWslPath(winPath) {
  const normalized = winPath.replace(/\\/g, "/");
  const m = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!m) return normalized;
  return `/mnt/${m[1].toLowerCase()}/${m[2]}`;
}

function setEnvKey(file, key, value) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const line = `${key}=${value}`;
  const next = current.includes(`${key}=`)
    ? current.replace(new RegExp(`${key}=.*`, "u"), line)
    : `${current.trim()}\n${line}\n`;
  writeFileSync(file, next);
}

if (!existsSync(path.join(root, ".env"))) {
  const secret = randomBytes(32).toString("hex");
  const example = path.join(root, ".env.example");
  if (existsSync(example)) copyFileSync(example, path.join(root, ".env"));
  setEnvKey(path.join(root, ".env"), "COOKIE_SECRET", secret);
  console.log("Wrote .env with a generated COOKIE_SECRET.");
}

await run("npm", ["install"]);

let dbReady = false;
try {
  await run("docker", ["compose", "up", "-d", "postgres"]);
  console.log("Waiting for Postgres...");
  await new Promise((r) => setTimeout(r, 5000));
  dbReady = true;
} catch {
  console.log("Docker Compose Postgres is unavailable. Trying WSL PostgreSQL…");
  const script = toWslPath(path.join(root, "scripts/wsl-pg.sh"));
  const wsl = await runCapture("wsl", ["-e", "bash", script]);
  if (wsl.code === 0 && wsl.text.includes("READY")) {
    const ipOut = await runCapture("wsl", ["-e", "bash", "-lc", "hostname -I"]);
    const ip = ipOut.text.trim().split(/\s+/)[0];
    if (ip) {
      setEnvKey(path.join(root, ".env"), "DATABASE_URL", `postgresql://contextos:contextos@${ip}:5432/contextos`);
      console.log(`Using WSL Postgres at ${ip}:5432`);
      dbReady = true;
    }
  }
}

if (!dbReady) {
  console.error("Could not start Postgres. Start Docker Desktop, then re-run: node scripts/setup.mjs");
  process.exit(1);
}

await run("npm", ["run", "generate", "-w", "@contextos/db"]);
await run("npm", ["run", "db:migrate"]);
await run("npm", ["run", "db:seed"]);
console.log("\nContextOS is ready.");
console.log("  npm run dev          # API :3001  Web :5173");
console.log("  demo login           demo@contextos.dev / DemoPassw0rd!");
