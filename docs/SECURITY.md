# Security

## Auth

- Passwords: **argon2id**
- Sessions: random token, SHA-256 at rest, HttpOnly cookie `contextos_session`, `SameSite=Lax`. `Secure` is on only when `PUBLIC_WEB_ORIGIN` is `https:` or `COOKIE_SECURE=true` (so `docker compose` on http://localhost:8080 can sign in).
- CSRF: synchronizer token per session, required on cookie-authenticated mutations via `x-csrf-token`. In production the `Origin` header is required and must match the allowlist. In development, `localhost` and `127.0.0.1` on any port are allowed so Vite can hop ports. Bearer agent requests skip CSRF.
- Agent keys: `cos_` prefix, argon2id hash, displayed once, rotatable by the project owner
- Production **refuses to boot** if `COOKIE_SECRET` is missing, shorter than 32 characters, or matches a weak placeholder

## HTTP

- Helmet (HSTS, X-Frame-Options, X-Content-Type-Options). JSON responses get `Content-Security-Policy: default-src 'none'` (plus frame-ancestors/base-uri/form-action/object-src none). `/api/docs` (Swagger UI) uses a looser CSP that allows `'self'` + `'unsafe-inline'` scripts and styles.
- CORS allowlist from `PUBLIC_WEB_ORIGIN` (+ optional `CORS_ORIGINS`)
- Rate limits globally; stricter on register/login
- RBAC: project **owner** vs **member** vs **agent** (scoped to its project). Verify, project delete, key rotation, webhooks, event purge: humans (owner where noted)

## What we do not claim

- Encryption at rest is **not** implemented
- We do not run a multi-tenant cloud
- Webhook deliveries use a shared secret header; TLS is your reverse proxy’s job

## Secrets

Never commit `.env`. Use `.env.example`. `npm audit --audit-level=high` should stay clean; if an upstream issue is unavoidable, document it here.
