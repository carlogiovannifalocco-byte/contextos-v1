import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "connectors", "mcp", "src", "index.ts");
const destDir = path.join(root, "packages", "cli", "src", "mcp");
const dest = path.join(destDir, "index.ts");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Copied MCP connector → packages/cli/src/mcp/index.ts");
