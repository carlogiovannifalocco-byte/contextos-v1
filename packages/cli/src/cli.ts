import { parseInvocation } from "./args.js";
import { runBrief } from "./commands/brief.js";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { CLI_VERSION } from "./constants.js";
import { helpText } from "./help.js";
import { out } from "./ui.js";

/** Returns the process exit code. Every failure throws a CliError instead. */
export async function run(argv: readonly string[], cwd: string): Promise<number> {
  const invocation = parseInvocation(argv);
  switch (invocation.kind) {
    case "help":
      out(helpText(invocation.topic));
      return 0;
    case "version":
      out(CLI_VERSION);
      return 0;
    case "init":
      await runInit(invocation.options, cwd);
      return 0;
    case "status":
      await runStatus(invocation.options, cwd);
      return 0;
    case "brief":
      await runBrief(invocation.options, cwd);
      return 0;
  }
}
