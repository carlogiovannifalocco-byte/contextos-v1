import { useCallback, useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, apiText } from "../api";
import { Icon } from "../components/Icons";
import { PageHead } from "../components/PageHead";
import { CopyButton } from "../components/CopyButton";

type Project = { id: string; name: string };

type Compiled = {
  budget: { tokens: number; usedTokens: number; note: string };
  counts: { candidates: number; included: number; omitted: number; superseded: number };
  included: {
    score: number;
    reasons: string[];
    stale: boolean;
    contested: boolean;
    truncated: boolean;
    tokens: number;
    memory: { id: string; title: string; type: string };
  }[];
  omitted: { id: string; title: string; type: string }[];
};

const BUDGETS = [1000, 2000, 4000, 8000] as const;

export function BriefPage() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const { liveTick } = useOutletContext<{ project: Project; liveTick?: number }>();
  const [budget, setBudget] = useState<number>(2000);
  const [focus, setFocus] = useState("");
  const [appliedFocus, setAppliedFocus] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [data, setData] = useState<Compiled | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextFocus: string) => {
      setLoading(true);
      const params = new URLSearchParams({ budget: String(budget) });
      if (nextFocus) params.set("focus", nextFocus);
      try {
        const [json, md] = await Promise.all([
          api<Compiled>(`/api/v1/projects/${projectId}/context-package?${params}`),
          apiText(`/api/v1/projects/${projectId}/context-package?${params}&format=md`),
        ]);
        setData(json);
        setMarkdown(md);
        setAppliedFocus(nextFocus);
      } finally {
        setLoading(false);
      }
    },
    [budget, projectId],
  );

  useEffect(() => {
    void load(appliedFocus);
    // Reloads on budget change and on any live project event.
  }, [budget, liveTick, projectId]);

  const used = data?.budget.usedTokens ?? 0;
  const total = data?.budget.tokens ?? budget;
  const fill = Math.min(100, Math.round((used / total) * 100));

  return (
    <div>
      <PageHead
        kicker={t("brief.kicker")}
        title={t("app.brief")}
        actions={markdown ? <CopyButton text={markdown} label={t("brief.copy")} /> : undefined}
      >
        <p className="muted">{t("brief.lead")}</p>
      </PageHead>

      <div className="brief-controls">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void load(focus.trim());
          }}
        >
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder={t("brief.focusPlaceholder")}
            aria-label={t("brief.focusLabel")}
            data-testid="brief-focus"
          />
          <button className="btn ghost" type="submit">
            <Icon name="search" size={15} />
            {t("brief.apply")}
          </button>
        </form>
        <div className="row" role="group" aria-label={t("brief.budgetLabel")}>
          {BUDGETS.map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${budget === value ? "" : "ghost"}`}
              aria-pressed={budget === value}
              onClick={() => setBudget(value)}
            >
              {value.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {data ? (
        <>
          <div className="budget-meter" data-testid="brief-meter">
            <div className="budget-bar">
              <span style={{ width: `${fill}%` }} />
            </div>
            <p className="mono muted">
              {t("brief.tokens", { used, total })} · {t("brief.estimate")}
            </p>
          </div>

          <div className="stats">
            <div className="stat">
              <strong>{data.counts.included}</strong>
              <span>{t("brief.statIncluded")}</span>
            </div>
            <div className="stat">
              <strong>{data.counts.omitted}</strong>
              <span>{t("brief.statOmitted")}</span>
            </div>
            <div className="stat">
              <strong>{data.counts.superseded}</strong>
              <span>{t("brief.statSuperseded")}</span>
            </div>
            <div className="stat">
              <strong>{data.counts.candidates}</strong>
              <span>{t("brief.statCandidates")}</span>
            </div>
          </div>
        </>
      ) : null}

      <div className="brief-split">
        <section className="section-card">
          <h2>{t("brief.exactText")}</h2>
          <p className="muted">{t("brief.exactTextHint")}</p>
          <pre className="brief-md" data-testid="brief-markdown">
            {loading && !markdown ? t("app.loading") : markdown}
          </pre>
        </section>

        <section className="section-card">
          <h2>{t("brief.why")}</h2>
          <p className="muted">{t("brief.whyHint")}</p>
          <ol className="brief-rank">
            {(data?.included ?? []).map((entry) => (
              <li key={entry.memory.id}>
                <span className="mono brief-score">{entry.score}</span>
                <span className="brief-rank-body">
                  <strong>{entry.memory.title}</strong>
                  <span className="row">
                    <span className={`stamp ${entry.memory.type}`}>{entry.memory.type}</span>
                    {entry.reasons
                      .filter((r) => !r.startsWith("type:"))
                      .map((r) => (
                        <span key={r} className="chip">
                          {r}
                        </span>
                      ))}
                    {entry.truncated ? <span className="chip warn">{t("brief.truncated")}</span> : null}
                    <span className="mono muted">~{entry.tokens}t</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>

          {data && data.omitted.length > 0 ? (
            <>
              <h3>{t("brief.omittedTitle")}</h3>
              <p className="muted">{t("brief.omittedHint")}</p>
              <ul className="brief-omitted">
                {data.omitted.map((entry) => (
                  <li key={entry.id}>
                    <span className={`stamp ${entry.type}`}>{entry.type}</span> {entry.title}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
