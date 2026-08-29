# Sprint status

**Last updated:** 2026-08-29 (published to GitHub)

**Repo:** https://github.com/carlogiovannifalocco-byte/contextos-v1  
**Release:** https://github.com/carlogiovannifalocco-byte/contextos-v1/releases/tag/v1.0.0-beta  
**CI:** passing (97 unit + 7 e2e)  
**CLI install:** [release tarball](https://github.com/carlogiovannifalocco-byte/contextos-v1/releases/download/v1.0.0-beta/contextos-memory-1.0.0-beta.tgz) (npm registry pending `NPM_TOKEN`)

## What shipped this session

| Area | Change |
| --- | --- |
| **Onboarding UX** | Welcome banner on first workspace visit for invited users; translated role names on cards and banner |
| **Release** | `docs/RELEASE.md` + `docs/NPM.md` — CLI publishes as `contextos-memory` on npm |
| **App home** | `GET /api/v1/projects` returns `role` per project; badges on cards; banner for shared-only users |
| **Role admin** | `PATCH .../members/:userId` — promote viewer ↔ member from Privacy |
| **Invite roles** | Owner picks **member** or **viewer** when inviting (incl. pending invites) |
| **Pricing** | `/pricing` — honest self-hosted $0 page (no fake cloud Pro) |
| **Prisma Windows** | `scripts/sync-prisma-client.mjs` runs after `prisma generate` (nested workspace client) |
| **Team** | `GET/POST/DELETE /api/v1/projects/:id/members` — invite existing users by email, list team, remove members |
| **Privacy UI** | Team panel with invite/remove; webhook testids for e2e |
| **E2E** | Landing scrolls to TokenCompare; `privacy-admin.spec.ts` + `privacy.png` screenshot |
| **Landing** | `TokenCompare` — interactive dump vs compiled-brief token estimator (EN/IT + CSS) |
| **Privacy** | Webhook list with pause/remove; secret shown once on create |
| **CI docs** | `docs/CI.md` + `examples/github-actions/contextos-brief.yml` |
| **Context compiler** | `GET /api/v1/projects/:id/context-package?budget=&focus=&format=md` ranks memory (pinned > verified > type > recency > BM25 focus), drops superseded entries, packs into token budget, returns markdown brief |
| **Memory graph** | `MemoryRelation` model + `POST/GET/DELETE /api/v1/memory/:id/relations`; `supersedes` archives the target |
| **Search** | `GET .../memory?q=` re-orders matches by BM25 relevance |
| **MCP** | `get_brief`, `supersede_memory`, `link_memory`, `get_memory_relations`; `get_context_package` accepts budget/focus |
| **CLI** | `contextos-memory` on npm (command `contextos`) — `init`, `status`, `brief` |
| **UI** | Workspace **Brief** tab — live preview of agent markdown + ranking sidebar; Memory **Links** panel with supersede |
| **Tests** | **40** unit/API tests (was 19): +21 rank/context compiler tests |
| **Docker prod** | **Executed on WSL2** (Docker Engine 29.1.3 in Ubuntu 26.04). Baseline `docker compose -f docker-compose.prod.yml up --build` healthy; migrations applied; auth locked. `.dockerignore` fixed for nested `node_modules`. Further hardening in progress. |

## 12 publication criteria

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | Stranger path | **Pass** (setup + demo + CLI init path documented) |
| 2 | `docker compose -f docker-compose.prod.yml up --build` | **Pass on WSL2 Docker** (not Windows Desktop daemon). `.dockerignore` fix required for reliable builds. |
| 3 | Demo register → scan/seed → memory → MCP → SSE | **Pass** |
| 4 | UI surfaces, i18n, a11y, screenshots | **Pass** (landing, brief, privacy, viewer, pricing) |
| 5 | Security (cookies, CSRF, hashes, Helmet + CSP) | **Pass** on code. nginx SPA origin now has baseline security headers. |
| 6 | Unit + API integration + Playwright + CI YAML | **Pass** (97 unit/API + 7 e2e) |
| 7 | Docs | **Pass** (README, MCP, QUICKSTART; Docker honesty updated) |
| 8 | `npm audit --audit-level=high` | **Pass** (0 high vulnerabilities) |
| 9 | Honest v1.0 Beta | **Pass** |
| 10 | Seed story | **Pass** |
| 11 | We ran the path | **Pass** local Node + WSL Docker compose |
| 12 | Original API list | **Pass** (+ relations, compiled brief) |

## Test counts

- Shared: **5**
- API: **41** (21 integration + 21 unit including rank/context)
- CLI: **51**
- Root `npm test`: **97** (shared + api + cli)
- Playwright e2e: **7** (+ pricing screenshot)

## How to run (this machine)

```powershell
npm run dev:api
$env:CONTEXTOS_API_ORIGIN="http://127.0.0.1:3010"
$env:WEB_PORT="5174"
npm run dev:web
```

http://127.0.0.1:5174/ — `demo@contextos.dev` / `DemoPassw0rd!` — open **Brief** in Atlas CLI workspace.

```powershell
npm run build -w contextos-memory
npx contextos brief --api http://127.0.0.1:3010 --format md
```

## Known gaps

- `prisma generate` on Windows npm workspaces can fail with "Could not resolve @prisma/client"; workaround: output to `node_modules/.prisma/client` at repo root (configured) and run `node scripts/sync-prisma-client.mjs` after schema changes (also wired into `npm run generate -w @contextos/db`).
- Windows Docker Desktop service still Stopped; use **WSL2 Docker** (`docker.io` in Ubuntu) or fix Desktop for native Windows compose.
