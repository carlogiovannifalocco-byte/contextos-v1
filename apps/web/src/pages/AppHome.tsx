import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ensureCsrf } from "../api";
import { Memo } from "../mascot/Memo";
import { Icon } from "../components/Icons";
import { PageHead } from "../components/PageHead";
import { projectRoleLabel } from "../roleLabel";

type Project = {
  id: string;
  name: string;
  description: string;
  rootPath?: string | null;
  role?: string;
  _count?: Record<string, number>;
};

export function AppHome({ onReady }: { onReady?: (projects: Project[]) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      await ensureCsrf();
      const res = await api<{ projects: Project[] }>("/api/v1/projects");
      setProjects(res.projects);
      onReady?.(res.projects);
      if (res.projects[0] && res.projects.length === 1) {
        navigate(`/p/${res.projects[0].id}`);
      }
    })().catch(() => setProjects([]));
  }, [navigate, onReady]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ project: Project }>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name, rootPath: "fixtures/atlas-cli" }),
      });
      navigate(`/p/${res.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    }
  }

  if (!projects) {
    return (
      <div className="loader wrap">
        <Memo className="memo-breathe" size={52} />
        <p>{t("app.loading")}</p>
      </div>
    );
  }

  const sharedOnly = projects.length > 0 && projects.every((p) => p.role && p.role !== "owner");

  return (
    <div className="wrap" style={{ padding: "40px 0" }}>
      <PageHead title={t("app.onboarding")} />
      {sharedOnly ? (
        <p className="banner" role="status" data-testid="shared-projects-banner">
          {t("app.sharedProjectsBanner")}
        </p>
      ) : null}
      <div className="row" style={{ marginBottom: 8 }}>
        <Memo size={72} mood="wave" className="memo-breathe" />
        <p className="lede" style={{ margin: 0 }}>
          {t("app.onboardingLead")}
        </p>
      </div>
      <form className="card stack" onSubmit={create} style={{ maxWidth: 460, marginTop: 12 }}>
        <label>
          <span>{t("app.projectName")}</span>
          <input data-testid="project-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" type="submit" data-testid="create-project">
          <Icon name="plus" size={15} />
          {t("app.createProject")}
        </button>
      </form>
      {projects.length > 0 ? (
        <div className="project-list">
          {projects.map((p) => (
            <Link className="project-card" to={`/p/${p.id}`} key={p.id} data-testid="project-card">
              <span className="kicker">{t("ui.project")}</span>
              {p.role ? (
                <span className={`stamp ${p.role === "viewer" ? "note" : "convention"}`}>
                  {projectRoleLabel(p.role, t)}
                </span>
              ) : null}
              <h3>{p.name}</h3>
              <p className="muted">{p.description || t("ui.openWorkspace")}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
