import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ensureCsrf } from "../api";
import { Memo } from "../mascot/Memo";
import { Icon } from "../components/Icons";
import { projectRoleLabel } from "../roleLabel";

type Project = {
  id: string;
  name: string;
  description: string;
  rootPath: string | null;
  _count?: { memories: number; tasks: number; agents: number; conflicts: number };
};

export function WorkspaceLayout() {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [role, setRole] = useState("member");
  const [welcome, setWelcome] = useState("");
  const [liveTick, setLiveTick] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      await ensureCsrf();
      const res = await api<{ project: Project; role: string }>(`/api/v1/projects/${projectId}`);
      setProject(res.project);
      setRole(res.role);
      const welcomeKey = `cos_welcome_${projectId}`;
      if (res.role !== "owner" && !sessionStorage.getItem(welcomeKey)) {
        sessionStorage.setItem(welcomeKey, "1");
        setWelcome(t("app.joinedProject", { role: projectRoleLabel(res.role, t, "sentence") }));
      }
    })().catch(() => navigate("/app"));
  }, [projectId, navigate, liveTick]);

  useEffect(() => {
    if (!projectId) return;
    const src = new EventSource(`/api/v1/projects/${projectId}/stream`, { withCredentials: true });
    src.onopen = () => setLive(true);
    src.onerror = () => setLive(false);
    src.onmessage = () => setLiveTick((n) => n + 1);
    src.addEventListener("ready", () => setLive(true));
    return () => src.close();
  }, [projectId]);

  if (!project || !projectId) {
    return (
      <div className="loader wrap">
        <Memo className="memo-breathe" size={48} />
        <p>{t("app.loadingWorkspace")}</p>
      </div>
    );
  }

  const tabs = [
    ["", t("app.overview"), "overview"],
    ["brief", t("app.brief"), "brain"],
    ["memory", t("app.memory"), "memory"],
    ["tasks", t("app.tasks"), "tasks"],
    ["agents", t("app.agents"), "agents"],
    ["activity", t("app.activity"), "activity"],
    ["privacy", t("app.privacy"), "privacy"],
  ] as const;

  const canWrite = role === "owner" || role === "member";
  const isOwner = role === "owner";

  return (
    <div className="app-shell">
      <aside className="side">
        <div className="brand" style={{ marginBottom: 8, padding: "0 6px" }}>
          <Memo size={34} />
          <span>
            {project.name}
            <small>PROJECT</small>
          </span>
        </div>
        <p className="live-pill" aria-live="polite">
          <span className={`live-dot ${live ? "on" : ""}`} />
          {live ? t("app.liveOn") : t("app.liveWait")}
        </p>
        <nav className="side-nav" aria-label="Workspace">
          {tabs.map(([path, label, icon]) => (
            <NavLink
              key={path || "overview"}
              end={path === ""}
              to={path ? `/p/${projectId}/${path}` : `/p/${projectId}`}
            >
              <Icon name={icon} size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/settings">
          <Icon name="settings" size={16} />
          <span>{t("app.settings")}</span>
        </NavLink>
      </aside>
      <div className="workspace page-enter">
        {!canWrite ? (
          <p className="banner" role="status" data-testid="viewer-banner">
            {t("app.viewerBanner")}
          </p>
        ) : null}
        {welcome ? (
          <p className="banner" role="status" data-testid="welcome-banner">
            {welcome}
          </p>
        ) : null}
        <Outlet context={{ project, liveTick, role, canWrite, isOwner }} />
      </div>
    </div>
  );
}
