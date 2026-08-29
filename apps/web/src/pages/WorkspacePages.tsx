import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { Memo } from "../mascot/Memo";
import { Icon } from "../components/Icons";
import { PageHead } from "../components/PageHead";
import { CopyButton } from "../components/CopyButton";

type Project = {
  id: string;
  name: string;
  description: string;
  rootPath: string | null;
  _count?: { memories: number; tasks: number; agents: number; conflicts: number };
};
type Memory = {
  id: string;
  type: string;
  title: string;
  body: string;
  pinned: boolean;
  verified: boolean;
  currentVersion: number;
  createdByType: string;
};
type Task = { id: string; title: string; description: string; status: string; assigneeAgentId: string | null };
type Agent = {
  id: string;
  name: string;
  kind: string;
  presence: string;
  activity: string;
  lastHeartbeat: string | null;
};
type Conflict = {
  id: string;
  reason: string;
  status: string;
  memoryA: Memory;
  memoryB: Memory;
};
type EventRow = { id: string; type: string; createdAt: string; payload: Record<string, unknown> };
type Handoff = { id: string; summary: string; details: string; status: string };
type LinkedMemory = { id: string; title: string; type: string; status: string };
type Relations = {
  outgoing: { id: string; kind: string; note: string; to: LinkedMemory }[];
  incoming: { id: string; kind: string; note: string; from: LinkedMemory }[];
};

function useProjectId() {
  const { projectId } = useParams();
  const { project, liveTick, role, canWrite, isOwner } = useOutletContext<{
    project: Project;
    liveTick?: number;
    role: string;
    canWrite: boolean;
    isOwner: boolean;
  }>();
  return { projectId: projectId!, project, liveTick: liveTick ?? 0, role, canWrite, isOwner };
}

function prettyEvent(type: string) {
  return type.replaceAll(".", " · ").replaceAll("_", " ");
}

export function OverviewPage() {
  const { t } = useTranslation();
  const { projectId, project, liveTick, canWrite } = useProjectId();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [scanMsg, setScanMsg] = useState("");
  const [pendingJob, setPendingJob] = useState<{ id: string; proposals: { id: string; title: string }[] } | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ conflicts: Conflict[] }>(`/api/v1/projects/${projectId}/conflicts`),
      api<{ tasks: Task[] }>(`/api/v1/projects/${projectId}/tasks`),
      api<{ events: EventRow[] }>(`/api/v1/projects/${projectId}/events?limit=8`),
    ]).then(([c, ta, ev]) => {
      setConflicts(c.conflicts.filter((x) => x.status === "open"));
      setTasks(ta.tasks);
      setEvents(ev.events);
    });
  }, [projectId, liveTick]);

  async function scan() {
    setScanMsg(t("app.scanning"));
    setPendingJob(null);
    const job = await api<{ job: { id: string } }>(`/api/v1/projects/${projectId}/scan`, {
      method: "POST",
      body: JSON.stringify({ rootPath: project.rootPath || "fixtures/atlas-cli" }),
    });
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const st = await api<{ job: { status: string; id: string; proposals: { id: string; title: string }[] } }>(
        `/api/v1/scan-jobs/${job.job.id}`,
      );
      if (st.job.status === "completed") {
        const n = st.job.proposals.length;
        if (n === 0) {
          setScanMsg(t("app.scanNone"));
          return;
        }
        setPendingJob({ id: st.job.id, proposals: st.job.proposals });
        setScanMsg(t("app.scanWaiting", { count: n }));
        return;
      }
      if (st.job.status === "failed" || st.job.status === "cancelled") {
        setScanMsg(t("app.scanFailed", { status: st.job.status }));
        return;
      }
    }
    setScanMsg(t("app.scanStill"));
  }

  async function activateScan() {
    if (!pendingJob) return;
    const res = await api<{ activated: number }>(`/api/v1/scan-jobs/${pendingJob.id}/activate`, {
      method: "POST",
      body: "{}",
    });
    setScanMsg(t("app.scanActivated", { count: res.activated }));
    setPendingJob(null);
  }

  const openTasks = tasks.filter((x) => x.status !== "done").length;

  return (
    <div>
      <PageHead
        kicker={t("beta")}
        title={project.name}
        actions={
          canWrite ? (
            <button className="btn" type="button" data-testid="scan-folder" onClick={() => void scan()}>
              <Icon name="scan" size={16} />
              {t("app.scan")}
            </button>
          ) : undefined
        }
      >
        <p className="muted">{project.description}</p>
      </PageHead>
      {conflicts[0] ? (
        <div className="banner" role="status" data-testid="conflict-banner">
          <strong>{t("app.conflict")}:</strong> {conflicts[0].reason}{" "}
          <Link to={`/p/${projectId}/activity`}>{t("app.conflictCenter")}</Link>
        </div>
      ) : null}
      <Link className="card section-card brief-promo" to={`/p/${projectId}/brief`} data-testid="brief-promo">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="kicker">{t("brief.kicker")}</p>
            <strong>{t("app.brief")}</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {t("brief.lead")}
            </p>
          </div>
          <Icon name="brain" size={28} />
        </div>
      </Link>
      <div className="grid-3" style={{ margin: "20px 0" }}>
        <article className="card stat rail" style={{ ["--rail" as string]: "var(--filament)" }}>
          <span className="muted">{t("app.memory")}</span>
          <span className="num">{project._count?.memories ?? "—"}</span>
          <span className="muted">{t("app.entries")}</span>
        </article>
        <article className="card stat rail" style={{ ["--rail" as string]: "var(--ion)" }}>
          <span className="muted">{t("app.openTasks")}</span>
          <span className="num">{openTasks}</span>
        </article>
        <article className="card stat rail" style={{ ["--rail" as string]: "var(--mint)" }}>
          <span className="muted">{t("app.rootPath")}</span>
          <p className="mono" style={{ margin: 0 }}>
            {project.rootPath || t("ui.notSet")}
          </p>
        </article>
      </div>
      <div className="row">
        {canWrite && pendingJob ? (
          <button className="btn ghost" type="button" data-testid="activate-scan" onClick={() => void activateScan()}>
            <Icon name="stamp" size={16} />
            {t("app.activateScan")}
          </button>
        ) : null}
        {scanMsg ? (
          <span className="muted" data-testid="scan-status">
            {scanMsg}
          </span>
        ) : null}
      </div>
      {pendingJob ? (
        <ul className="mono" data-testid="scan-proposals">
          {pendingJob.proposals.map((p) => (
            <li key={p.id}>{p.title}</li>
          ))}
        </ul>
      ) : null}
      <h2 style={{ marginTop: 32 }}>{t("app.checklist")}</h2>
      <ol className="beats">
        <li>{t("app.check1")}</li>
        <li>{t("app.check2")}</li>
        <li>{t("app.check3")}</li>
        <li>{t("app.check4")}</li>
      </ol>
      <h2>{t("app.timeline")}</h2>
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id}>
            <span className="mono">{prettyEvent(e.type)}</span>
            <div className="muted">{new Date(e.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MemoryPage() {
  const { t } = useTranslation();
  const { projectId, liveTick, canWrite } = useProjectId();
  const [items, setItems] = useState<Memory[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [memType, setMemType] = useState("decision");
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ version: number; title: string; createdAt: string }[]>([]);
  const [linksFor, setLinksFor] = useState<string | null>(null);
  const [links, setLinks] = useState<Relations | null>(null);
  const [supersedeTarget, setSupersedeTarget] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    const res = await api<{ memories: Memory[] }>(`/api/v1/projects/${projectId}/memory?${params}`);
    setItems(res.memories);
  }

  useEffect(() => {
    void load();
  }, [projectId, liveTick]);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api(`/api/v1/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({ type: memType, title, body }),
    });
    setTitle("");
    setBody("");
    await load();
  }

  async function patch(id: string, data: Record<string, unknown>) {
    await api(`/api/v1/memory/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    await load();
  }

  async function showVersions(id: string) {
    const res = await api<{ versions: typeof versions }>(`/api/v1/memory/${id}/versions`);
    setVersionsFor(id);
    setVersions(res.versions);
  }

  async function showLinks(id: string) {
    if (linksFor === id) {
      setLinksFor(null);
      return;
    }
    const res = await api<Relations>(`/api/v1/memory/${id}/relations`);
    setLinksFor(id);
    setLinks(res);
    setSupersedeTarget("");
  }

  async function supersede(id: string) {
    if (!supersedeTarget) return;
    await api(`/api/v1/memory/${id}/relations`, {
      method: "POST",
      body: JSON.stringify({ toId: supersedeTarget, kind: "supersedes" }),
    });
    setSupersedeTarget("");
    await Promise.all([load(), showLinksAfterChange(id)]);
  }

  async function unlink(id: string, relationId: string) {
    await api(`/api/v1/memory/${id}/relations/${relationId}`, { method: "DELETE" });
    await Promise.all([load(), showLinksAfterChange(id)]);
  }

  async function showLinksAfterChange(id: string) {
    const res = await api<Relations>(`/api/v1/memory/${id}/relations`);
    setLinks(res);
  }

  return (
    <div>
      <PageHead title={t("app.memory")} />
      <div className="row">
        <input
          placeholder={t("app.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("app.allTypes")}</option>
          {["decision", "convention", "fact", "note", "constraint", "risk"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button className="btn ghost" type="button" onClick={() => void load()}>
          <Icon name="search" size={15} />
          {t("app.filter")}
        </button>
      </div>
      {canWrite ? (
        <form className="card stack" onSubmit={add} style={{ margin: "16px 0" }}>
          <strong>{t("app.addMemory")}</strong>
          <select value={memType} onChange={(e) => setMemType(e.target.value)}>
            {["decision", "convention", "fact", "note", "constraint", "risk"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input data-testid="memory-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("ui.title")} required />
          <textarea data-testid="memory-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("ui.body")} required rows={4} />
          <button className="btn" type="submit" data-testid="add-memory">
            <Icon name="plus" size={15} />
            {t("app.addMemory")}
          </button>
        </form>
      ) : null}
      {items.length === 0 ? (
        <div className="empty">
          <Memo mood="think" />
          <p>{t("app.emptyMemory")}</p>
        </div>
      ) : (
        items.map((m) => (
          <article className={`memory-item ${m.type}`} key={m.id}>
            <div className="row">
              <span className={`stamp ${m.type}`}>{m.type}</span>
              {m.pinned ? <span className="stamp fact">{t("ui.pinned")}</span> : null}
              {m.verified ? <span className="stamp convention">{t("ui.verified")}</span> : null}
              <span className="muted mono">v{m.currentVersion}</span>
            </div>
            <h3>{m.title}</h3>
            <p>{m.body}</p>
            <div className="row">
              {canWrite ? (
                <>
                  <button className="btn ghost btn-sm" type="button" onClick={() => void patch(m.id, { verified: !m.verified })}>
                    <Icon name="check" size={14} />
                    {t("app.verify")}
                  </button>
                  <button className="btn ghost btn-sm" type="button" onClick={() => void patch(m.id, { pinned: !m.pinned })}>
                    <Icon name="pin" size={14} />
                    {t("app.pin")}
                  </button>
                </>
              ) : null}
              <button className="btn ghost btn-sm" type="button" onClick={() => void showVersions(m.id)}>
                {t("app.history")}
              </button>
              <button
                className="btn ghost btn-sm"
                type="button"
                aria-expanded={linksFor === m.id}
                onClick={() => void showLinks(m.id)}
              >
                <Icon name="split" size={14} />
                {t("app.links")}
              </button>
            </div>
            {versionsFor === m.id ? (
              <ul className="mono">
                {versions.map((v) => (
                  <li key={v.version}>
                    v{v.version} {v.title}
                  </li>
                ))}
              </ul>
            ) : null}
            {linksFor === m.id && links ? (
              <div className="links-panel">
                {links.outgoing.length === 0 && links.incoming.length === 0 ? (
                  <p className="muted">{t("app.noLinks")}</p>
                ) : (
                  <ul className="link-list">
                    {links.outgoing.map((rel) => (
                      <li key={rel.id}>
                        <span className="chip">{rel.kind}</span>
                        <span>{rel.to.title}</span>
                        <span className="muted mono">{rel.to.status}</span>
                        {canWrite ? (
                          <button className="btn ghost btn-sm" type="button" onClick={() => void unlink(m.id, rel.id)}>
                            {t("app.unlink")}
                          </button>
                        ) : null}
                      </li>
                    ))}
                    {links.incoming.map((rel) => (
                      <li key={rel.id}>
                        <span className="chip in">{t("app.linkedFrom", { kind: rel.kind })}</span>
                        <span>{rel.from.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {canWrite ? (
                  <div className="row">
                    <select
                      value={supersedeTarget}
                      onChange={(e) => setSupersedeTarget(e.target.value)}
                      aria-label={t("app.supersedeLabel")}
                    >
                      <option value="">{t("app.supersedePick")}</option>
                      {items
                        .filter((other) => other.id !== m.id)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.title}
                          </option>
                        ))}
                    </select>
                    <button
                      className="btn btn-sm"
                      type="button"
                      disabled={!supersedeTarget}
                      onClick={() => void supersede(m.id)}
                    >
                      {t("app.supersede")}
                    </button>
                  </div>
                ) : null}
                <p className="muted">{t("app.supersedeHint")}</p>
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}

const COLUMNS = ["open", "in_progress", "blocked", "done"] as const;

export function TasksPage() {
  const { t } = useTranslation();
  const { projectId, liveTick, canWrite } = useProjectId();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  async function load() {
    const res = await api<{ tasks: Task[] }>(`/api/v1/projects/${projectId}/tasks`);
    setTasks(res.tasks);
  }
  useEffect(() => {
    void load();
  }, [projectId, liveTick]);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api(`/api/v1/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({ title }) });
    setTitle("");
    await load();
  }

  async function move(id: string, status: string) {
    await api(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }

  const colLabel: Record<(typeof COLUMNS)[number], string> = {
    open: t("app.colOpen"),
    in_progress: t("app.colProgress"),
    blocked: t("app.colBlocked"),
    done: t("app.colDone"),
  };

  return (
    <div>
      <PageHead title={t("app.tasks")} />
      {canWrite ? (
        <form className="row" onSubmit={add}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("app.newTask")} required />
          <button className="btn" type="submit">
            <Icon name="plus" size={15} />
            {t("app.addTask")}
          </button>
        </form>
      ) : null}
      <div className="kanban" style={{ marginTop: 16 }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((task) => task.status === col);
          return (
            <section key={col}>
              <h3>
                {colLabel[col]}
                <span>{colTasks.length}</span>
              </h3>
              {colTasks.map((task) => (
                <article className="task" key={task.id}>
                  <strong>{task.title}</strong>
                  {task.description ? <p className="muted">{task.description}</p> : null}
                  <select
                    value={task.status}
                    disabled={!canWrite}
                    onChange={(e) => void move(task.id, e.target.value)}
                    aria-label={t("app.moveTask")}
                  >
                    {COLUMNS.map((c) => (
                      <option key={c} value={c}>
                        {colLabel[c]}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function AgentsPage() {
  const { t } = useTranslation();
  const { projectId, liveTick, canWrite } = useProjectId();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("cursor");
  const [revealed, setRevealed] = useState<string | null>(null);

  async function load() {
    const [a, h] = await Promise.all([
      api<{ agents: Agent[] }>(`/api/v1/projects/${projectId}/agents`),
      api<{ handoffs: Handoff[] }>(`/api/v1/projects/${projectId}/handoffs`),
    ]);
    setAgents(a.agents);
    setHandoffs(h.handoffs);
  }
  useEffect(() => {
    void load();
  }, [projectId, liveTick]);

  async function register(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ agent: Agent; apiKey: string }>(`/api/v1/projects/${projectId}/agents/register`, {
      method: "POST",
      body: JSON.stringify({ name, kind }),
    });
    setRevealed(res.apiKey);
    setName("");
    await load();
  }

  const envBlock = `CONTEXTOS_PROJECT_ID=${projectId}\nCONTEXTOS_API_URL=http://127.0.0.1:3001`;

  return (
    <div>
      <PageHead title={t("app.agents")} />
      <article className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>{t("app.mcpEnv")}</h3>
          <CopyButton text={envBlock} />
        </div>
        <pre className="code-block card" style={{ margin: 0 }}>
          {envBlock}
        </pre>
        <p className="muted">{t("app.mcpPortHint")}</p>
        <p className="muted">{t("app.mcpHint")}</p>
      </article>
      {revealed ? (
        <div className="banner">
          <p>{t("app.keyOnce")}</p>
          <div className="row">
            <code className="mono">{revealed}</code>
            <CopyButton text={revealed} />
          </div>
        </div>
      ) : null}
      {canWrite ? (
        <form className="row" onSubmit={register}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("app.agentName")} required />
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option>cursor</option>
            <option>claude-code</option>
            <option>generic</option>
          </select>
          <button className="btn" type="submit">
            {t("app.registerAgent")}
          </button>
        </form>
      ) : null}
      <div className="grid-3" style={{ marginTop: 16 }}>
        {agents.map((agent) => (
          <article className="card" key={agent.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>{agent.name}</h3>
              <span className={`presence ${agent.presence}`}>{agent.presence}</span>
            </div>
            <p className="mono muted">{agent.kind}</p>
            <p>{agent.activity}</p>
          </article>
        ))}
      </div>
      <h2>{t("app.handoffs")}</h2>
      {handoffs.length === 0 ? (
        <p className="muted">{t("ui.noHandoffs")}</p>
      ) : (
        <ul>
          {handoffs.map((h) => (
            <li key={h.id}>
              <strong>{h.summary}</strong>
              <p>{h.details}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActivityPage() {
  const { t } = useTranslation();
  const { projectId, liveTick, canWrite } = useProjectId();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergeBody, setMergeBody] = useState("");

  async function load() {
    const [ev, c] = await Promise.all([
      api<{ events: EventRow[] }>(`/api/v1/projects/${projectId}/events`),
      api<{ conflicts: Conflict[] }>(`/api/v1/projects/${projectId}/conflicts`),
    ]);
    setEvents(ev.events);
    setConflicts(c.conflicts);
  }
  useEffect(() => {
    void load();
  }, [projectId, liveTick]);

  const open = useMemo(() => conflicts.filter((c) => c.status === "open"), [conflicts]);

  async function merge(id: string) {
    await api(`/api/v1/conflicts/${id}/merge`, {
      method: "POST",
      body: JSON.stringify({
        title: mergeTitle || open[0]?.memoryA.title,
        body: mergeBody || `${open[0]?.memoryA.body}\n\n---\n\n${open[0]?.memoryB.body}`,
      }),
    });
    await load();
  }

  async function resolve(id: string, winnerId: string) {
    await api(`/api/v1/conflicts/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ winnerId, resolution: "Human picked a winner." }),
    });
    await load();
  }

  return (
    <div>
      <PageHead title={t("app.activity")} />
      {open.map((c) => (
        <section className="banner" key={c.id} style={{ marginBottom: 16 }} data-testid="conflict-panel">
          <h3>
            <Icon name="conflict" size={16} /> {t("app.conflict")}
          </h3>
          <p>{c.reason}</p>
          <div className="duel">
            <article className="card">
              <h4>{c.memoryA.title}</h4>
              <p>{c.memoryA.body}</p>
              <button className="btn ghost" type="button" disabled={!canWrite} onClick={() => void resolve(c.id, c.memoryA.id)}>
                {t("app.resolve")}
              </button>
            </article>
            <span className="vs">VS</span>
            <article className="card">
              <h4>{c.memoryB.title}</h4>
              <p>{c.memoryB.body}</p>
              <button className="btn ghost" type="button" disabled={!canWrite} onClick={() => void resolve(c.id, c.memoryB.id)}>
                {t("app.resolve")}
              </button>
            </article>
          </div>
          {canWrite ? (
            <form
              className="stack"
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                void merge(c.id);
              }}
            >
              <input data-testid="merge-title" value={mergeTitle} onChange={(e) => setMergeTitle(e.target.value)} placeholder={t("ui.mergedTitle")} />
              <textarea data-testid="merge-body" value={mergeBody} onChange={(e) => setMergeBody(e.target.value)} rows={5} placeholder={t("ui.mergedBody")} />
              <button className="btn" type="submit" data-testid="merge-conflict">
                {t("app.merge")}
              </button>
            </form>
          ) : null}
        </section>
      ))}
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id}>
            <span className="mono">{prettyEvent(e.type)}</span>
            <span className="muted">{new Date(e.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastFiredAt: string | null;
  lastStatus: number | null;
  createdAt: string;
};

type TeamMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  memberId?: string;
  joinedAt: string;
};

type PendingInvite = {
  inviteId: string;
  email: string;
  role: string;
  invitedAt: string;
};

export function ProjectPrivacyPage() {
  const { t } = useTranslation();
  const { projectId, canWrite, isOwner } = useProjectId();
  const [ignore, setIgnore] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "viewer">("member");
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState("");

  async function loadWebhooks() {
    const res = await api<{ webhooks: WebhookRow[] }>(`/api/v1/projects/${projectId}/webhooks`);
    setWebhooks(res.webhooks);
  }

  async function loadTeam() {
    const res = await api<{ members: TeamMember[]; pending?: PendingInvite[] }>(`/api/v1/projects/${projectId}/members`);
    setTeam(res.members);
    setPending(res.pending ?? []);
  }

  useEffect(() => {
    void api<{ content: string }>(`/api/v1/projects/${projectId}/ignore-rules`).then((r) => setIgnore(r.content));
    if (isOwner) void loadWebhooks();
    void loadTeam();
  }, [projectId, isOwner]);

  async function saveIgnore(e: FormEvent) {
    e.preventDefault();
    await api(`/api/v1/projects/${projectId}/ignore-rules`, { method: "PUT", body: JSON.stringify({ content: ignore }) });
    setMsg(t("app.ignoreSaved"));
  }

  async function exportJson() {
    const data = await api(`/api/v1/projects/${projectId}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contextos-project.json";
    a.click();
  }

  async function purge() {
    await api(`/api/v1/projects/${projectId}/events`, { method: "DELETE" });
    setMsg(t("app.eventsPurged"));
  }

  async function addHook(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ secret: string }>(`/api/v1/projects/${projectId}/webhooks`, {
      method: "POST",
      body: JSON.stringify({ url: webhookUrl, events: ["*"] }),
    });
    setSecret(res.secret);
    setWebhookUrl("");
    await loadWebhooks();
  }

  async function toggleHook(hook: WebhookRow) {
    await api(`/api/v1/webhooks/${hook.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !hook.enabled }),
    });
    await loadWebhooks();
  }

  async function removeHook(hook: WebhookRow) {
    if (!confirm(t("app.webhookDeleteConfirm"))) return;
    await api(`/api/v1/webhooks/${hook.id}`, { method: "DELETE" });
    await loadWebhooks();
  }

  async function inviteMember(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ pending?: { email: string }; member?: { email: string } }>(
      `/api/v1/projects/${projectId}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      },
    );
    setInviteEmail("");
    setMsg(res.pending ? t("app.memberInvitedPending") : t("app.memberInvited"));
    await loadTeam();
  }

  async function revokePending(invite: PendingInvite) {
    await api(`/api/v1/projects/${projectId}/invites/${invite.inviteId}`, { method: "DELETE" });
    await loadTeam();
  }

  async function removeMember(member: TeamMember) {
    if (!confirm(t("app.memberRemoveConfirm", { name: member.name }))) return;
    await api(`/api/v1/projects/${projectId}/members/${member.userId}`, { method: "DELETE" });
    await loadTeam();
  }

  async function setMemberRole(member: TeamMember, role: "member" | "viewer") {
    await api(`/api/v1/projects/${projectId}/members/${member.userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    setMsg(t("app.roleUpdated"));
    await loadTeam();
  }

  async function destroy() {
    if (!confirm(t("ui.deleteProjectConfirm"))) return;
    await api(`/api/v1/projects/${projectId}`, { method: "DELETE" });
    window.location.href = "/app";
  }

  return (
    <div>
      <PageHead title={t("app.privacy")} />
      {msg ? <p role="status">{msg}</p> : null}
      <div className="row">
        <button className="btn" type="button" onClick={() => void exportJson()}>
          <Icon name="export" size={15} />
          {t("app.export")}
        </button>
        {isOwner ? (
          <>
            <button className="btn ghost" type="button" onClick={() => void purge()}>
              {t("app.purgeEvents")}
            </button>
            <button className="btn danger" type="button" onClick={() => void destroy()}>
              {t("app.deleteProject")}
            </button>
          </>
        ) : null}
      </div>
      {canWrite ? (
        <form className="card stack section-card" onSubmit={saveIgnore}>
          <label>
            <span>.contextosignore</span>
            <textarea rows={10} value={ignore} onChange={(e) => setIgnore(e.target.value)} className="mono" />
          </label>
          <button className="btn" type="submit">
            {t("app.saveIgnore")}
          </button>
        </form>
      ) : (
        <article className="card section-card">
          <h3>.contextosignore</h3>
          <pre className="mono brief-md sample">{ignore || t("ui.notSet")}</pre>
        </article>
      )}
      <section className="card section-card stack" data-testid="team-panel">
        <h3>{t("app.team")}</h3>
        <ul className="hook-list team-list" data-testid="team-list">
          {team.map((member) => (
            <li key={member.userId}>
              <div>
                <strong>{member.name}</strong>
                <div className="hook-meta">
                  <span className="mono">{member.email}</span>
                  <span>{member.role}</span>
                </div>
              </div>
              {isOwner && member.role !== "owner" ? (
                <div className="hook-actions">
                  <select
                    data-testid={`member-role-${member.userId}`}
                    value={member.role === "viewer" ? "viewer" : "member"}
                    onChange={(e) => void setMemberRole(member, e.target.value as "member" | "viewer")}
                    aria-label={t("app.inviteRole")}
                  >
                    <option value="member">{t("app.roleMember")}</option>
                    <option value="viewer">{t("app.roleViewer")}</option>
                  </select>
                  <button className="btn danger ghost" type="button" onClick={() => void removeMember(member)}>
                    {t("app.memberRemove")}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {pending.length ? (
          <ul className="hook-list team-list" data-testid="pending-invites">
            {pending.map((invite) => (
              <li key={invite.inviteId}>
                <div>
                  <code className="mono">{invite.email}</code>
                  <div className="hook-meta">
                    <span>{t("app.invitePending")}</span>
                    <span>{new Date(invite.invitedAt).toLocaleString()}</span>
                  </div>
                </div>
                {isOwner ? (
                  <div className="hook-actions">
                    <button className="btn danger ghost" type="button" onClick={() => void revokePending(invite)}>
                      {t("app.inviteRevoke")}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {isOwner ? (
          <form className="stack" onSubmit={inviteMember}>
            <label>
              <span>{t("app.inviteEmail")}</span>
              <input
                data-testid="invite-email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                type="email"
                required
                placeholder={t("app.invitePlaceholder")}
              />
            </label>
            <label>
              <span>{t("app.inviteRole")}</span>
              <select data-testid="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "member" | "viewer")}>
                <option value="member">{t("app.roleMember")}</option>
                <option value="viewer">{t("app.roleViewer")}</option>
              </select>
            </label>
            <button className="btn" type="submit" data-testid="invite-member">
              {t("app.inviteMember")}
            </button>
            <p className="muted">{t("app.inviteHint")}</p>
          </form>
        ) : null}
      </section>
      {isOwner ? (
        <section className="card section-card stack" data-testid="webhook-panel">
        <h3>{t("app.webhooks")}</h3>
        {webhooks.length ? (
          <ul className="hook-list">
            {webhooks.map((hook) => (
              <li key={hook.id}>
                <div>
                  <code className="mono">{hook.url}</code>
                  <div className="hook-meta">
                    <span>{hook.events.join(", ")}</span>
                    <span>
                      {t("app.webhookLastFired")}:{" "}
                      {hook.lastFiredAt ? new Date(hook.lastFiredAt).toLocaleString() : t("app.webhookNever")}
                      {hook.lastStatus ? ` (${hook.lastStatus})` : ""}
                    </span>
                  </div>
                </div>
                <div className="hook-actions">
                  <button className="btn ghost" type="button" onClick={() => void toggleHook(hook)}>
                    {hook.enabled ? t("app.webhookEnabled") : t("app.webhookDisabled")}
                  </button>
                  <button className="btn danger ghost" type="button" onClick={() => void removeHook(hook)}>
                    {t("app.webhookDelete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" data-testid="webhook-empty">{t("app.noWebhooks")}</p>
        )}
        <form className="stack" onSubmit={addHook}>
          <label>
            <span>{t("app.webhookUrl")}</span>
            <input
              data-testid="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              type="url"
              required
            />
          </label>
          <button className="btn" type="submit" data-testid="add-webhook">
            {t("app.addWebhook")}
          </button>
          {secret ? (
            <p>
              <span className="muted">{t("app.webhookSecretOnce")}</span>
              <br />
              <code className="mono">{secret}</code>
            </p>
          ) : null}
        </form>
      </section>
      ) : null}
    </div>
  );
}
