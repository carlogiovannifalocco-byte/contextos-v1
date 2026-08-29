# Changelog

## 1.0.0-beta — 2026-08-29

First publication-oriented local-first cut.

### Context compiler (killer feature)

- `GET /api/v1/projects/:id/context-package?budget=&focus=&format=md` — ranks memory, drops superseded entries, packs into a token budget, returns markdown brief
- BM25 relevance for `?q=` search and `?focus=` on the brief
- `MemoryRelation` graph: `supersedes`, `contradicts`, `references`, `parent_of`
- Workspace **Brief** tab — live preview of what agents read, with budget slider and ranking sidebar
- MCP: `get_brief`, `supersede_memory`, `link_memory`, `get_memory_relations`

### Onboarding

- `contextos-memory` on npm (command `contextos`) — `init`, `status`, `brief` (51 unit tests). `@contextos/cli` is taken on npm.
- Landing **TokenCompare** — interactive token savings calculator (dump vs compiled brief)
- Privacy **Webhooks** panel — list, pause, remove; signing secret shown once
- `docs/CI.md` + `examples/github-actions/contextos-brief.yml` for pipeline brief export
- **Team invites** — owner invites by email; existing users join immediately, new users auto-join on register (`ProjectInvite`)
- **Viewer role** — read-only teammates; members and agents keep write access
- **Welcome banner** — first visit for invited members/viewers shows localized role
- **`PATCH .../members/:userId`** — owner promotes viewer ↔ member from Privacy team panel
- **`/pricing`** — transparent self-hosted pricing (no hosted SaaS in beta)

### Core (unchanged from first cut)

- Shared versioned memory, human verify/pin
- Agents with hashed `cos_` keys, heartbeat, presence, handoffs
- Tasks Kanban, folder scan proposals, lexical conflict merge/resolve
- Playwright: register → scan → memory → conflict merge; demo brief screenshot
- REST + OpenAPI, SSE/WebSocket, MCP stdio (`npm run mcp` / `npm run mcp:smoke`)
- Session cookies, CSRF, argon2id passwords, production COOKIE_SECRET fail-closed
- Marketing + workspace UI (EN/IT, dark/light), Memo mascot
- Docker Compose production path verified on WSL2; `.dockerignore` fix for nested `node_modules`
