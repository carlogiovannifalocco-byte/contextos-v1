import { promises as fs } from "node:fs";
import path from "node:path";
import ignore from "ignore";
import { prisma } from "@contextos/db";
import { EVENT_NAMES } from "@contextos/shared";
import type { FastifyInstance } from "fastify";
import { emitEvent } from "../lib/events.js";
import { resolveScanRoot } from "./scan-root.js";

export { resolveScanRoot };

const DEFAULT_IGNORE = `node_modules
.git
dist
build
.env
coverage
*.log
`;

type ProposalDraft = {
  type: "decision" | "convention" | "fact" | "note";
  title: string;
  body: string;
  sourcePath: string;
};

async function walk(
  dir: string,
  scanRoot: string,
  ig: ReturnType<typeof ignore>,
  acc: string[],
  cancelled: () => Promise<boolean>,
): Promise<void> {
  if (await cancelled()) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(scanRoot, full).replace(/\\/g, "/");
    if (rel && ig.ignores(rel)) continue;
    if (entry.isDirectory()) {
      await walk(full, scanRoot, ig, acc, cancelled);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
}

async function readHead(file: string, max = 4000): Promise<string> {
  try {
    const buf = await fs.readFile(file);
    return buf.subarray(0, max).toString("utf8");
  } catch {
    return "";
  }
}

export async function runScanJob(app: FastifyInstance, jobId: string) {
  const job = await prisma.scanJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });

  const cancelled = async () => {
    const fresh = await prisma.scanJob.findUnique({ where: { id: jobId } });
    return Boolean(fresh?.cancelled);
  };

  try {
    const rulesRow = await prisma.ignoreRules.findUnique({ where: { projectId: job.projectId } });
    const ig = ignore().add(rulesRow?.content ?? DEFAULT_IGNORE);
    const files: string[] = [];
    const root = resolveScanRoot(job.rootPath);
    await walk(root, root, ig, files, cancelled);

    if (await cancelled()) {
      await prisma.scanJob.update({
        where: { id: jobId },
        data: { status: "cancelled", finishedAt: new Date(), filesSeen: files.length },
      });
      return;
    }

    const drafts: ProposalDraft[] = [];
    const pkg = files.find((f) => path.basename(f) === "package.json");
    if (pkg) {
      const raw = await readHead(pkg);
      try {
        const json = JSON.parse(raw) as { name?: string; version?: string; engines?: { node?: string } };
        if (json.name) {
          drafts.push({
            type: "fact",
            title: `Package name is ${json.name}`,
            body: `${json.name}${json.version ? ` @ ${json.version}` : ""}${json.engines?.node ? `. Node ${json.engines.node}.` : ""}`,
            sourcePath: path.relative(root, pkg).replace(/\\/g, "/"),
          });
        }
      } catch {
        /* ignore invalid json */
      }
    }

    const readme = files.find((f) => /^readme(\.md|\.txt)?$/i.test(path.basename(f)));
    if (readme) {
      const text = await readHead(readme);
      const heading = text.split("\n").find((l) => l.startsWith("# "));
      if (heading) {
        drafts.push({
          type: "note",
          title: heading.replace(/^#\s+/, "").slice(0, 120),
          body: text.slice(0, 1200),
          sourcePath: path.relative(root, readme).replace(/\\/g, "/"),
        });
      }
    }

    const editorconfig = files.find((f) => path.basename(f) === ".editorconfig");
    if (editorconfig) {
      const text = await readHead(editorconfig);
      drafts.push({
        type: "convention",
        title: "EditorConfig is present",
        body: text.slice(0, 800) || "The repo ships an .editorconfig. Follow it unless a later decision overrides it.",
        sourcePath: path.relative(root, editorconfig).replace(/\\/g, "/"),
      });
    }

    if (drafts.length === 0) {
      drafts.push({
        type: "fact",
        title: `Scanned ${path.basename(root)}`,
        body: `Saw ${files.length} files. No package.json, README, or .editorconfig produced a structured proposal. Add those files or write memory by hand.`,
        sourcePath: ".",
      });
    }

    await prisma.scanProposal.createMany({
      data: drafts.map((d) => ({
        scanJobId: jobId,
        type: d.type,
        title: d.title,
        body: d.body,
        sourcePath: d.sourcePath,
      })),
    });

    await prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        finishedAt: new Date(),
        filesSeen: files.length,
      },
    });

    await emitEvent(app, {
      projectId: job.projectId,
      type: EVENT_NAMES.scanCompleted,
      payload: { jobId, filesSeen: files.length, proposals: drafts.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
  }
}
