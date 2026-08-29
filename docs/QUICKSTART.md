# Quickstart

## Development

You need **Node 22+** and **PostgreSQL 16+**. Docker is the usual way to get Postgres; it is not the only way.

```bash
node scripts/setup.mjs
npm run dev
```

`setup.mjs` writes `.env` if missing, tries `docker compose up -d postgres`, generates Prisma client, **applies SQL migrations** (`migrate deploy`, not `db push`), and seeds the Atlas CLI story.

If Docker Desktop is not running, setup tries **WSL PostgreSQL** (creates role `contextos` / database `contextos`) and points `DATABASE_URL` at the WSL IP.

- Web: http://127.0.0.1:5173 (Vite uses the next port if 5173 is taken)
- API: http://127.0.0.1:3001 (set `PORT` in `.env` if 3001 is taken)
- Health: `/api/health`
- OpenAPI: `/api/docs`

Demo login after seed: `demo@contextos.dev` / `DemoPassw0rd!`

Then: open **Atlas CLI** → Memory already has a story → Activity has the ignore-syntax conflict → Agent Hub for MCP.

### This Windows host (honest)

Docker Desktop’s Windows service did not start (engine pipe missing). **Production compose was executed on WSL2 Ubuntu 26.04** after installing `docker.io` + `docker-compose-v2` there (`docker compose -f docker-compose.prod.yml up --build` — all three services healthy, migrations applied, auth locked). Windows-native Docker was not used. Local dev on this machine uses WSL PostgreSQL 18.

## Production Compose

Copy `.env.example` to `.env`. Set `COOKIE_SECRET` to **32+ random characters** that are not a placeholder. Production refuses to boot otherwise.

```bash
docker compose -f docker-compose.prod.yml up --build
```

- Web: http://localhost:8080 (nginx proxies `/api` and `/ws`)
- API also published on http://localhost:3001 for MCP
- OpenAPI: http://localhost:3001/api/docs or http://localhost:8080/api/docs

**Executed on WSL2 Ubuntu 26.04** (Docker Engine 29.1.3 installed via `apt`; Windows Docker Desktop still Stopped). Verified: images build, `prisma migrate deploy` on API start, `/api/health` with `db: up`, nginx serves SPA + proxies `/api`, unauthenticated mutations return 401, weak/missing `COOKIE_SECRET` refuses boot. `.dockerignore` was fixed so nested `**/node_modules` (including Windows Prisma engines) never enter the Linux build context.

HTTP localhost compose keeps cookies non-Secure. Set `COOKIE_SECURE=true` (and HTTPS) behind TLS.

## Verify

```bash
node scripts/verify.mjs
```

Point `CONTEXTOS_API_URL` at the API if it is not on port 3001.

## Tests

Vitest loads the repo-root `.env` (written by `setup.mjs`). **API integration tests need Postgres + `DATABASE_URL`.** Unit tests (shared, COOKIE_SECRET, CSP policy, scan path) do not.

```bash
npm test
npm run test:e2e
```

If `DATABASE_URL` is missing and there is no `.env`, `npm test` prints **one** message and skips integration tests instead of dumping Prisma stack traces.

CI (`.github/workflows/ci.yml`) starts Postgres 16 and sets `DATABASE_URL` on the `npm test` step.

E2E defaults to `http://127.0.0.1:5173` + API `3001`. Override:

```bash
# PowerShell
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:5174"
$env:CONTEXTOS_API_ORIGIN="http://127.0.0.1:3010"
npm run test:e2e
```
