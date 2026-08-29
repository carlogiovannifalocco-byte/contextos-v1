import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import { prisma } from "./index.js";

function loadDotEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const file of [path.resolve(here, "../../../.env"), path.resolve(process.cwd(), ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
    break;
  }
}
loadDotEnv();

const DEFAULT_IGNORE = `node_modules
.git
dist
build
.env
coverage
*.log
`;

async function main() {
  const email = "demo@contextos.dev";
  const password = process.env.SEED_PASSWORD ?? "DemoPassw0rd!";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Ada Demo" },
    create: {
      email,
      passwordHash,
      name: "Ada Demo",
      language: "en",
      theme: "system",
    },
  });

  await prisma.project.deleteMany({
    where: { ownerId: user.id, slug: "atlas-cli" },
  });

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: "Atlas CLI",
      slug: "atlas-cli",
      description:
        "Local-first knowledge CLI. Two agents share one brain while shipping the scanner.",
      rootPath: "fixtures/atlas-cli",
    },
  });

  await prisma.ignoreRules.create({
    data: { projectId: project.id, content: DEFAULT_IGNORE },
  });

  const forge = await prisma.agent.create({
    data: {
      projectId: project.id,
      name: "Forge",
      kind: "cursor",
      description: "Cursor agent implementing the filesystem scanner.",
      presence: "online",
      activity: "Writing scan ignore rules",
      lastHeartbeat: new Date(),
    },
  });

  const scribe = await prisma.agent.create({
    data: {
      projectId: project.id,
      name: "Scribe",
      kind: "claude-code",
      description: "Claude Code agent owning docs and conventions.",
      presence: "idle",
      activity: "Drafting README conventions",
      lastHeartbeat: new Date(Date.now() - 40_000),
    },
  });

  const memories = [
    {
      type: "decision" as const,
      title: "Postgres is the only datastore",
      body: "Atlas persists structured knowledge in PostgreSQL. SQLite is out of scope for v1 so the team can use real migrations and row-level access later.",
      tags: ["storage", "v1"],
      pinned: true,
      verified: true,
      createdByType: "user" as const,
      createdByUserId: user.id,
    },
    {
      type: "convention" as const,
      title: "No default exports in TypeScript",
      body: "Named exports only. Makes grepping and re-exports predictable across agents.",
      tags: ["typescript"],
      pinned: true,
      verified: true,
      createdByType: "agent" as const,
      createdByAgentId: scribe.id,
    },
    {
      type: "fact" as const,
      title: "Package name is @atlas/cli",
      body: "The CLI ships as @atlas/cli. Binary name: atlas. Node 22+.",
      tags: ["package"],
      pinned: false,
      verified: true,
      createdByType: "agent" as const,
      createdByAgentId: forge.id,
    },
    {
      type: "note" as const,
      title: "Scanner must be heuristic, not an LLM",
      body: "Folder scan extracts package.json, README headings, and editorconfig. Do not pretend we understand architecture from filenames alone.",
      tags: ["scan"],
      pinned: false,
      verified: false,
      createdByType: "agent" as const,
      createdByAgentId: forge.id,
    },
    {
      type: "constraint" as const,
      title: "Never commit .env",
      body: "Secrets stay on the operator machine. .env.example is the only committed template.",
      tags: ["security"],
      pinned: true,
      verified: true,
      createdByType: "user" as const,
      createdByUserId: user.id,
    },
    {
      type: "decision" as const,
      title: "Ignore file syntax",
      body: "Forge: .contextosignore MUST use gitignore syntax including negation and nested globs so existing ignore files can be reused.",
      tags: ["scan", "conflict"],
      pinned: false,
      verified: false,
      createdByType: "agent" as const,
      createdByAgentId: forge.id,
    },
    {
      type: "decision" as const,
      title: "Ignore file syntax",
      body: "Scribe: .contextosignore should be glob-only (no gitignore negation) so agents can implement matching in 20 lines without a parser.",
      tags: ["scan", "conflict"],
      pinned: false,
      verified: false,
      createdByType: "agent" as const,
      createdByAgentId: scribe.id,
    },
    {
      type: "risk" as const,
      title: "Two agents may overwrite the same convention",
      body: "Without human verify, Scribe and Forge can silently contradict each other on ignore syntax. Keep the conflict open until Ada merges.",
      tags: ["collaboration"],
      pinned: false,
      verified: false,
      createdByType: "system" as const,
    },
  ];

  const createdMemories = [];
  for (const m of memories) {
    const entry = await prisma.memoryEntry.create({
      data: {
        projectId: project.id,
        ...m,
        verifiedAt: m.verified ? new Date() : null,
        verifiedById: m.verified ? user.id : null,
      },
    });
    await prisma.memoryVersion.create({
      data: {
        memoryId: entry.id,
        version: 1,
        type: entry.type,
        title: entry.title,
        body: entry.body,
        tags: entry.tags,
        createdByType: entry.createdByType,
        createdByUserId: entry.createdByUserId,
        createdByAgentId: entry.createdByAgentId,
      },
    });
    createdMemories.push(entry);
  }

  const forgeIgnore = createdMemories.find(
    (m) => m.createdByAgentId === forge.id && m.title === "Ignore file syntax",
  );
  const scribeIgnore = createdMemories.find(
    (m) => m.createdByAgentId === scribe.id && m.title === "Ignore file syntax",
  );

  if (forgeIgnore && scribeIgnore) {
    await prisma.conflict.create({
      data: {
        projectId: project.id,
        memoryAId: forgeIgnore.id,
        memoryBId: scribeIgnore.id,
        reason:
          "Two agents wrote opposite decisions with the same title: gitignore syntax vs glob-only.",
        status: "open",
      },
    });
  }

  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        title: "Ship gitignore-compatible ignore parser",
        description: "Blocked on the open conflict about ignore syntax.",
        status: "blocked",
        assigneeAgentId: forge.id,
        createdByType: "user",
        createdByUserId: user.id,
      },
      {
        projectId: project.id,
        title: "Document MCP setup in README",
        description: "Scribe drafts the agent prompt and JSON snippet.",
        status: "in_progress",
        assigneeAgentId: scribe.id,
        createdByType: "user",
        createdByUserId: user.id,
      },
      {
        projectId: project.id,
        title: "Add scan proposal activation UX",
        description: "Human must approve proposals before they become memory.",
        status: "open",
        assigneeAgentId: null,
        createdByType: "user",
        createdByUserId: user.id,
      },
      {
        projectId: project.id,
        title: "Choose Postgres as datastore",
        description: "Done. See pinned decision.",
        status: "done",
        assigneeAgentId: forge.id,
        createdByType: "agent",
        createdByAgentId: forge.id,
      },
    ],
  });

  await prisma.handoff.create({
    data: {
      projectId: project.id,
      fromAgentId: forge.id,
      toAgentId: scribe.id,
      summary: "Scanner walks the tree; docs need the ignore-syntax decision resolved.",
      details:
        "Forge implemented a recursive walk. Do not document glob-only until Ada merges the conflict. Next: Scribe updates MCP.md after merge.",
      status: "open",
    },
  });

  await prisma.event.createMany({
    data: [
      {
        projectId: project.id,
        type: "project.created",
        payload: { name: "Atlas CLI" },
        actorType: "user",
        actorUserId: user.id,
      },
      {
        projectId: project.id,
        type: "agent.registered",
        payload: { name: "Forge", kind: "cursor" },
        actorType: "user",
        actorUserId: user.id,
        actorAgentId: forge.id,
      },
      {
        projectId: project.id,
        type: "agent.registered",
        payload: { name: "Scribe", kind: "claude-code" },
        actorType: "user",
        actorUserId: user.id,
        actorAgentId: scribe.id,
      },
      {
        projectId: project.id,
        type: "conflict.detected",
        payload: { title: "Ignore file syntax" },
        actorType: "system",
      },
      {
        projectId: project.id,
        type: "handoff.created",
        payload: { from: "Forge", to: "Scribe" },
        actorType: "agent",
        actorAgentId: forge.id,
      },
    ],
  });

  console.log("Seeded ContextOS demo:");
  console.log(`  user:    ${email}`);
  console.log(`  password:${password}`);
  console.log(`  project: ${project.name} (${project.id})`);
  console.log(`  agents:  Forge (${forge.id}), Scribe (${scribe.id})`);
  console.log("  story:   open conflict on ignore-file syntax");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
