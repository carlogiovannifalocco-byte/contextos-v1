const enabled = process.env["NO_COLOR"] === undefined && process.stdout.isTTY === true;

function wrap(code: string): (text: string) => string {
  return (text: string) => (enabled ? `\u001B[${code}m${text}\u001B[0m` : text);
}

export const style = {
  bold: wrap("1"),
  dim: wrap("2"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  cyan: wrap("36"),
};

export function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

export function raw(text: string): void {
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

export function ok(label: string, detail: string): void {
  out(`${style.green("✓")} ${label.padEnd(11)}${detail}`);
}

export function info(label: string, detail: string): void {
  out(`${style.dim("·")} ${label.padEnd(11)}${detail}`);
}

export function warn(message: string): void {
  out(`${style.yellow("!")} ${message}`);
}
