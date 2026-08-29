# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x-beta | yes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email the maintainer with:

- What you found and where (API route, UI, MCP tool, Docker image, etc.)
- Steps to reproduce
- Impact assessment if you have one

We aim to acknowledge within **72 hours** and ship a fix or mitigation as fast as we can.

## Scope

ContextOS is **self-hosted**. You are responsible for:

- Postgres network access and backups
- `COOKIE_SECRET` strength (32+ chars, not a placeholder)
- Agent `cos_` keys in `.mcp.json` / `.cursor/mcp.json` (gitignored by `contextos init`)

Full model: [docs/SECURITY.md](docs/SECURITY.md).
