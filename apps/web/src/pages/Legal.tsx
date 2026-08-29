import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Memo } from "../mascot/Memo";

export function ChangelogPage() {
  return (
    <div className="wrap" style={{ padding: "40px 0 80px" }}>
      <p className="kicker">v1.0.0-beta</p>
      <h1>Changelog</h1>
      <article className="card rail" style={{ ["--rail" as string]: "var(--filament)" }}>
        <h2>1.0.0-beta — first public local-first cut</h2>
        <ul>
          <li>Shared memory with versions, verify, and pin</li>
          <li>Agent keys, heartbeat, presence, handoffs</li>
          <li>Tasks, scan proposals, lexical conflicts, MCP stdio</li>
          <li>Session cookies, CSRF, argon2id passwords</li>
        </ul>
      </article>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="wrap" style={{ padding: "40px 0 80px", maxWidth: 720 }}>
      <h1>Privacy</h1>
      <p>
        ContextOS is local-first. When you self-host, account data, memory, and agent keys live in your PostgreSQL. We do
        not operate a hosted cloud that collects your projects. Encryption at rest is not implemented — protect the disk
        and the database yourself. Agent API keys are hashed (argon2id) and shown once. Session cookies are HttpOnly.
      </p>
      <p>You can export or delete your account from Settings. Purging events and deleting a project are owner actions.</p>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="wrap" style={{ padding: "40px 0 80px", maxWidth: 720 }}>
      <h1>Terms</h1>
      <p>
        Software licensed under MIT, provided as-is. You are responsible for how agents write into shared memory and for
        who holds owner keys on your instance. No warranty, no SLA, no paid plan in this build.
      </p>
    </div>
  );
}

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="empty wrap">
      <Memo size={128} mood="alert" />
      <h1>{t("errors.notFound")}</h1>
      <Link className="btn" to="/">
        {t("errors.home")}
      </Link>
    </div>
  );
}
