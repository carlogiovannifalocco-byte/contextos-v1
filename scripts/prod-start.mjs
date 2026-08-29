import { spawn } from "node:child_process";
import { MIN_COOKIE_SECRET_LENGTH } from "./lib/boot-const.mjs";

const secret = process.env.COOKIE_SECRET ?? "";
if (!secret || secret.length < MIN_COOKIE_SECRET_LENGTH) {
  console.error(
    `COOKIE_SECRET must be at least ${MIN_COOKIE_SECRET_LENGTH} characters in production. Refusing to boot.`,
  );
  process.exit(1);
}
if (/change-me|dev-only|secret123|password/i.test(secret)) {
  console.error("COOKIE_SECRET looks weak. Refusing to boot production.");
  process.exit(1);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

await run("npm", ["run", "migrate", "-w", "@contextos/db"]);
await run("npx", ["tsx", "apps/api/src/index.ts"]);
