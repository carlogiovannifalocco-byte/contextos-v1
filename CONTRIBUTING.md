# Contributing

ContextOS is a small local-first product. Prefer cutting scope over adding a second abstraction.

## Setup

```bash
node scripts/setup.mjs
npm run dev
```

## Layout

- Contracts live in `packages/shared` (Zod + event names). API and MCP must follow them.
- Schema changes: edit `packages/db/prisma/schema.prisma`, then `npm run generate -w @contextos/db` and `npm run db:migrate`. On Windows, `generate` also runs `scripts/sync-prisma-client.mjs`.
- Do not use `prisma db push` for shipped environments.

## Tests

```bash
npm test
npm run test:e2e
npm run verify:full   # tests + builds + npm audit
```

`npm test` loads `.env` via the API Vitest setup file. Integration tests need Postgres (`DATABASE_URL`). Without it they skip with one message; unit tests still run.

CI (`.github/workflows/ci.yml`) runs unit tests, audit, web + CLI builds, MCP smoke, and Playwright e2e against Postgres 16.

Keep auth mutations locked. Do not add unauthenticated write routes.

## Docs

README must match the product. If you cut a feature, remove it from docs in the same change.

See also: [RELEASE.md](docs/RELEASE.md), [CI.md](docs/CI.md), [MCP.md](docs/MCP.md).
