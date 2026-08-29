# Architecture

ContextOS is an npm-workspaces monorepo.

```
apps/web          React 19 + Vite (marketing + workspace)
apps/api          Fastify 5 REST + SSE + WebSocket
packages/db       Prisma schema, SQL migrations, seed
packages/shared   Zod contracts, event names, constants
connectors/mcp    stdio MCP server for agents
e2e               Playwright
```

## Runtime

- **Browser** authenticates with an HttpOnly session cookie and sends `x-csrf-token` on mutations.
- **Agents / MCP** authenticate with `Authorization: Bearer cos_…`. Keys are argon2id-hashed. The raw key is shown once.
- **Postgres** is the only datastore. Schema changes go through Prisma migrations.
- **Realtime** is in-process: `RealtimeHub` fans events to SSE (`/api/v1/projects/:id/stream`) and WebSocket (`/ws?projectId=`). Not multi-instance.

## Memory model

`MemoryEntry` is the current document. Every content change appends a `MemoryVersion`. Humans may `verified` / `pinned`. Agents cannot verify.

Writing a decision/convention/constraint with a similar title to an existing active entry opens a `Conflict`. Humans merge (new verified body, archive the other) or resolve (pick a winner).

## Scan

`POST /api/v1/projects/:id/scan` walks `rootPath` with `.contextosignore` (gitignore syntax). It creates `ScanProposal` rows. `POST /api/v1/scan-jobs/:id/activate` promotes selected proposals to memory after a human confirms.

## Context package

`GET /api/v1/projects/:id/context-package` is the agent-facing snapshot: active memory, open tasks, open conflicts, handoffs, presence, and a reminder that verify is human-side.
