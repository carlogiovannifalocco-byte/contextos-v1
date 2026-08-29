# MCP setup

The connector is `connectors/mcp` (stdio). It talks to your local API with an agent key.

Smoke without Cursor: from the repo root, `npm run mcp:smoke`. That starts the stdio server, sends JSON-RPC `initialize`, and exits when the server answers.

## Fastest setup (CLI)

From any repo where you want agents to share ContextOS memory:

```bash
# With ContextOS API already running (local dev or compose)
cd /path/to/your/project
npx contextos-memory init --api http://127.0.0.1:3010
```

`contextos init` logs in (or registers), creates/selects a project, registers an agent, and writes `.cursor/mcp.json` + `.mcp.json` with the `cos_` key. It configures MCP to run **`contextos-mcp`** (bundled with the CLI) — no ContextOS repo checkout required. Re-running merges into existing MCP config without duplicating servers.

Other commands:

```bash
contextos status          # API health + project counts
contextos brief           # markdown brief (same as MCP get_brief)
contextos brief --focus "ignore file syntax" --budget 1500
```

## Environment

| Variable | Example |
| --- | --- |
| `CONTEXTOS_API_URL` | `http://localhost:3001` (or `http://127.0.0.1:3010` if you remapped `PORT`) |
| `CONTEXTOS_AGENT_KEY` | `cos_…` (from the project Agents tab, shown once) |
| `CONTEXTOS_PROJECT_ID` | Project cuid from the URL `/p/:id` |

## Tools (call order)

1. **`get_brief`** — markdown brief packed into a token budget. Pass `focus` with your current task. **Start here.**
2. **`get_context_package`** — same compiled brain as JSON (scores, omissions, superseded ids).
3. **`search_memory` / `write_memory`** — versioned entries. Humans verify.
4. **`supersede_memory`** — replace an outdated decision (archives the old entry).
5. **`link_memory`** — contradicts / references / parent_of links.
6. Tasks, presence, handoffs, events, conflict detection — as before.

## Cursor (copy this)

After `contextos init`, your project already has `.cursor/mcp.json`. Manual snippet:

```json
{
  "mcpServers": {
    "contextos": {
      "command": "contextos-mcp",
      "args": [],
      "env": {
        "CONTEXTOS_API_URL": "http://127.0.0.1:3001",
        "CONTEXTOS_AGENT_KEY": "cos_YOUR_KEY",
        "CONTEXTOS_PROJECT_ID": "PROJECT_ID"
      }
    }
  }
}
```

**Monorepo dev:** if you run ContextOS from a git checkout, `init` may use `npm run mcp` with `cwd` set to that repo instead.

```json
{
  "mcpServers": {
    "contextos": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/contextos-v1",
      "env": {
        "CONTEXTOS_API_URL": "http://127.0.0.1:3001",
        "CONTEXTOS_AGENT_KEY": "cos_YOUR_KEY",
        "CONTEXTOS_PROJECT_ID": "PROJECT_ID"
      }
    }
  }
}
```

## Claude Code

From the repo root:

```bash
claude mcp add contextos -- npm run mcp
```

Then set the same env vars in `.mcp.json` (or Claude’s user config).

## Tools

`get_context_package`, `search_memory`, `write_memory`, `list_tasks`, `create_task`, `update_task`, `heartbeat`, `set_presence`, `list_events`, `list_handoffs`, `create_handoff`, `detect_conflicts`.

There is **no verify tool**. Verification is a human action in the workspace.

## Recommended agent prompt

See `/agents` in the app, or:

> Before changing architecture, call `get_context_package`. Search memory before inventing rules. Write decisions back. If `detect_conflicts` shows an open conflict on your topic, stop and hand off.
