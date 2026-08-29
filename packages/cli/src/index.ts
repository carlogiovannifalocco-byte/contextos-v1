#!/usr/bin/env node
import { run } from "./cli.js";
import { CLI_NAME } from "./constants.js";
import { CliError } from "./errors.js";
import { redactSecrets } from "./redact.js";
import { style } from "./ui.js";

try {
  process.exitCode = await run(process.argv.slice(2), process.cwd());
} catch (error) {
  if (process.env["CONTEXTOS_DEBUG"] === "1" && error instanceof Error && error.stack !== undefined) {
    process.stderr.write(`${redactSecrets(error.stack)}\n`);
  }
  const detail = error instanceof Error ? error.message : String(error);
  const message = error instanceof CliError ? detail : `Unexpected failure: ${detail}`;
  process.stderr.write(`${style.red(`${CLI_NAME}:`)} ${redactSecrets(message)}\n`);
  process.exitCode = error instanceof CliError ? error.exitCode : 1;
}
