import { useTranslation } from "react-i18next";
import { Icon } from "../components/Icons";
import { CopyButton } from "../components/CopyButton";
import { PageHead } from "../components/PageHead";

const TOOLS = [
  ["get_brief", "START HERE. Markdown brief with budget + focus. Superseded decisions excluded."],
  ["get_context_package", "Same brain as JSON with scores, omissions, and superseded ids."],
  ["search_memory / write_memory", "Versioned entries. Verify stays on the human side."],
  ["supersede_memory / link_memory", "Replace outdated decisions instead of leaving contradictions."],
  ["list_tasks / create_task / update_task", "Shared Kanban."],
  ["heartbeat / set_presence", "Alive + what the agent is doing."],
  ["list_events / list_handoffs / create_handoff", "Timeline and agent-to-agent notes."],
  ["detect_conflicts", "Lexical detect only. Humans merge in the workspace."],
];

const CURSOR_JSON = `{
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
}`;

const PROMPT = `You are connected to ContextOS, the shared memory for this repo.
Before changing architecture or conventions, call get_brief (pass focus with your current task).
Search memory before inventing rules. Write decisions and facts back with write_memory.
When you replace an old decision, call supersede_memory — do not leave two contradictory entries.
Never mark memory as verified — humans do that in the dashboard.
If detect_conflicts shows an open conflict on your topic, stop and hand off.`;

export function AgentsHub() {
  const { t } = useTranslation();
  return (
    <div className="wrap" style={{ padding: "40px 0 80px" }}>
      <PageHead kicker="MCP" title={t("agentsHub.title")}>
        <p className="lede">{t("agentsHub.lead")}</p>
      </PageHead>
      <div className="grid-3" style={{ marginTop: 8 }}>
        {TOOLS.map(([name, desc]) => (
          <article className="card rail" key={name} style={{ ["--rail" as string]: "var(--ion)" }}>
            <div className="how-icon">
              <Icon name="spark" size={16} />
            </div>
            <h3>{name}</h3>
            <p className="muted">{desc}</p>
          </article>
        ))}
      </div>
      <div className="row" style={{ marginTop: 36, justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Cursor MCP snippet</h2>
        <CopyButton text={CURSOR_JSON} />
      </div>
      <p className="muted">
        Paste into Cursor MCP settings. <code>cwd</code> must be this repo root so <code>npm run mcp</code> resolves.
        Point CONTEXTOS_API_URL at the port in your .env (default 3001). Smoke: <code>npm run mcp:smoke</code>.
      </p>
      <pre className="card code-block">{CURSOR_JSON}</pre>
      <h2 style={{ marginTop: 28 }}>Claude Code</h2>
      <p>
        Add the same env vars in <code>.mcp.json</code> or run{" "}
        <code>claude mcp add contextos -- npm run mcp</code> from the repo root. Details in{" "}
        <code>docs/MCP.md</code>.
      </p>
      <div className="row" style={{ marginTop: 28, justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{t("agentsHub.promptTitle")}</h2>
        <CopyButton text={PROMPT} />
      </div>
      <pre className="card" style={{ whiteSpace: "pre-wrap" }}>
        {PROMPT}
      </pre>
    </div>
  );
}
