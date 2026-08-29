# Release checklist — v1.0.0-beta

Use this before tagging a public release or sharing the repo widely.

## Pre-flight

```bash
node scripts/setup.mjs
npm run verify:full    # tests + web/cli build + audit
npm run test:e2e
```

On Linux/WSL (production path):

```bash
docker compose -f docker-compose.prod.yml up --build
# → http://localhost:8080 healthy, demo login works, Brief tab loads
```

## Version bumps

These files should agree on **1.0.0-beta** (or the next semver):

| File | Field |
| --- | --- |
| `package.json` (root) | `version` |
| `packages/shared/package.json` | `version` |
| `packages/db/package.json` | `version` |
| `packages/cli/package.json` | `version` |
| `apps/api/package.json` | `version` |
| `apps/web/package.json` | `version` |
| `packages/shared/src/constants.ts` | `APP_VERSION` |
| `CHANGELOG.md` | top section date + version |

## Database

```bash
npm run generate -w @contextos/db
npm run db:migrate
```

On Windows, if `prisma generate` fails, run `node scripts/sync-prisma-client.mjs` after generate.

## Screenshots (Playwright)

Regenerate with a running API + web (or let CI/e2e do it locally):

```bash
npm run test:e2e
```

Artifacts land in `docs/screenshots/` (landing, login, agents, workspace, memory, brief, privacy, viewer, pricing).

## Git tag

**Prerequisite:** initial commit and remote configured (`git remote add origin …`).

```bash
node scripts/prepare-release.mjs   # verify:full + e2e + pack dry-run
git add -A && git commit -m "ContextOS v1.0.0-beta"
git tag -a v1.0.0-beta -m "ContextOS v1.0.0-beta — local-first shared memory for AI agents"
git push origin main --tags
```

## GitHub release

```bash
gh release create v1.0.0-beta --title "ContextOS v1.0.0-beta" --notes-file docs/releases/v1.0.0-beta.md
```

## npm (CLI)

Package name on npm is **`contextos-memory`** (`@contextos/cli` is taken). Command: `contextos`.

```bash
node scripts/pack-cli.mjs
cd packages/cli && npm publish --access public --tag beta
```

See [NPM.md](./NPM.md). Until `NPM_TOKEN` is set, install the CLI from the release asset:

```bash
npm install -g https://github.com/carlogiovannifalocco-byte/contextos-v1/releases/download/v1.0.0-beta/contextos-memory-1.0.0-beta.tgz
```

Or upload a new tarball after version bumps: `npm run upload:cli-release`.

## What we ship

- Self-hosted MIT stack (Postgres + API + SPA)
- Context compiler + MCP + CLI (`contextos init`, `brief`, `status`)
- Team invites (pending email → auto-join on register), member/viewer roles
- No ContextOS Cloud — see `/pricing`

## Post-release

- [ ] `npm publish` for `contextos-memory` (see [NPM.md](./NPM.md))
- [ ] Demo instance re-seeded if schema changed
- [ ] `STATUS.md` updated with test counts and criteria verdicts
