# contextos-memory

CLI for [ContextOS](https://github.com/your-org/contextos) — local-first shared memory for AI coding agents.

> **Note:** The npm name `@contextos/cli` is used by another project. This package publishes as **`contextos-memory`**; the command is still **`contextos`**.

## Install

```bash
npm install -g contextos-memory
# or run once:
npx contextos-memory init --api http://127.0.0.1:3001
```

Requires **Node 22+** and a running ContextOS API (self-hosted).

## Commands

| Command | What it does |
| --- | --- |
| `contextos init` | Sign in, pick/create a project, register an agent, write MCP config |
| `contextos status` | API health, memory/task/conflict counts, agent presence |
| `contextos brief` | Print the compiled markdown brief (same as MCP `get_brief`) |

```bash
contextos init --api http://127.0.0.1:3010 --project "My App"
contextos brief --focus "auth middleware" --budget 1500
contextos status
```

## Environment

| Variable | Purpose |
| --- | --- |
| `CONTEXTOS_API_URL` | API base URL (default `http://127.0.0.1:3001`) |
| `CONTEXTOS_PROJECT_ID` | Project id for `status` / `brief` |
| `CONTEXTOS_AGENT_KEY` | Agent key (`cos_…`) |

## License

MIT — see [LICENSE](../../LICENSE) in the monorepo root.
