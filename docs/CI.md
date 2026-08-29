# CI integration

ContextOS ships a root workflow at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) that runs unit tests, API integration tests, MCP smoke, and Playwright e2e against Postgres 16.

This guide shows how to **pull a compiled agent brief into your own pipeline** — useful for PR comments, release notes, or keeping a human-readable snapshot of project memory.

## Prerequisites

1. A running ContextOS API (self-hosted compose, dev server, or team instance).
2. An **agent key** (`cos_…`) with read access to the target project.
3. The CLI built or installed: `npm run build -w contextos-memory`.

Store secrets in your CI provider:

| Secret | Example |
| --- | --- |
| `CONTEXTOS_API_URL` | `https://contextos.example.com` |
| `CONTEXTOS_AGENT_KEY` | `cos_…` |
| `CONTEXTOS_PROJECT_ID` | UUID from the workspace URL |

`contextos init` writes `.contextos/config.json` locally; in CI, pass the same values via env vars (see example workflow).

## Example: brief on every PR

Copy [`examples/github-actions/contextos-brief.yml`](../examples/github-actions/contextos-brief.yml) into `.github/workflows/` or include it from your monorepo.

The job:

1. Checks out your repo (optional — only needed if you vendor ContextOS).
2. Installs Node 22 and builds `contextos-memory`.
3. Runs `contextos brief --format md` with your secrets.
4. Uploads `contextos-brief.md` as a workflow artifact (7-day retention).

### Local dry-run

```bash
npm run build -w contextos-memory
export CONTEXTOS_API_URL=http://127.0.0.1:3010
export CONTEXTOS_AGENT_KEY=cos_your_key
export CONTEXTOS_PROJECT_ID=your-project-uuid
npx contextos brief --format md > brief.md
```

## Wiring init once

On a developer machine:

```bash
npx contextos init --api http://127.0.0.1:3010
```

Copy the printed `projectId` and agent key into CI secrets. Re-run `init --new-key` if a key leaks.

## Related

- [MCP.md](./MCP.md) — agent tools (`get_brief`, `supersede_memory`, …)
- [QUICKSTART.md](./QUICKSTART.md) — local Postgres + dev servers
- Root `npm test` — full test matrix mirrored in CI
