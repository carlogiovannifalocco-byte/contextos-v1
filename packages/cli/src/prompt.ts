import { createInterface, type Interface } from "node:readline/promises";
import { CliError } from "./errors.js";

export type Prompter = {
  /** Ask for a value. `fallback` is the default shown in brackets. */
  ask(question: string, fallback?: string): Promise<string>;
  secret(question: string): Promise<string>;
  confirm(question: string, fallback: boolean): Promise<boolean>;
  close(): void;
};

/** readline hides input by replacing its echo hook while a secret is typed. */
type EchoHook = { _writeToOutput?: (chunk: string) => void };

class InteractivePrompter implements Prompter {
  #rl: Interface | undefined;

  #interface(): Interface {
    this.#rl ??= createInterface({ input: process.stdin, output: process.stdout });
    return this.#rl;
  }

  async ask(question: string, fallback?: string): Promise<string> {
    const suffix = fallback === undefined || fallback === "" ? "" : ` [${fallback}]`;
    const answer = (await this.#interface().question(`${question}${suffix}: `)).trim();
    if (answer !== "") return answer;
    if (fallback !== undefined && fallback !== "") return fallback;
    throw new CliError(`${question} is required.`);
  }

  async secret(question: string): Promise<string> {
    const rl = this.#interface();
    const pending = rl.question(`${question}: `);
    const hook = rl as unknown as EchoHook;
    hook._writeToOutput = () => undefined;
    try {
      const answer = await pending;
      return answer.trim();
    } finally {
      delete hook._writeToOutput;
      process.stdout.write("\n");
    }
  }

  async confirm(question: string, fallback: boolean): Promise<boolean> {
    const answer = (await this.#interface().question(`${question} ${fallback ? "[Y/n]" : "[y/N]"}: `))
      .trim()
      .toLowerCase();
    if (answer === "") return fallback;
    return answer === "y" || answer === "yes";
  }

  close(): void {
    this.#rl?.close();
    this.#rl = undefined;
  }
}

class AutoPrompter implements Prompter {
  async ask(question: string, fallback?: string): Promise<string> {
    if (fallback !== undefined && fallback !== "") return fallback;
    throw new CliError(`${question} is required. Pass it as a flag, or drop --yes to be asked.`);
  }

  async secret(question: string): Promise<string> {
    throw new CliError(`${question} is required. Pass it as a flag, or drop --yes to be asked.`);
  }

  async confirm(_question: string, fallback: boolean): Promise<boolean> {
    return fallback;
  }

  close(): void {
    // nothing to close
  }
}

export function createPrompter(nonInteractive: boolean): Prompter {
  if (nonInteractive || process.stdin.isTTY !== true) return new AutoPrompter();
  return new InteractivePrompter();
}
