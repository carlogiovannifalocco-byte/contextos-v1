import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TokenCompare } from "../components/TokenCompare";
import { Memo } from "../mascot/Memo";
import { Icon } from "../components/Icons";

const TAPE = [
  { who: "Forge", stamp: "decision", text: "Postgres is the only datastore." },
  { who: "Scribe", stamp: "convention", text: "No default exports in TypeScript." },
  { who: "Forge", stamp: "conflict", text: "Ignore files should use gitignore syntax." },
  { who: "Scribe", stamp: "conflict", text: "Ignore files should be glob-only." },
  { who: "Ada", stamp: "note", text: "Human still has to merge this." },
];

export function Landing() {
  const { t } = useTranslation();
  const how = [
    { icon: "brain" as const, title: t("landing.how1Title"), body: t("landing.how1") },
    { icon: "spark" as const, title: t("landing.how2Title"), body: t("landing.how2") },
    { icon: "stamp" as const, title: t("landing.how3Title"), body: t("landing.how3") },
    { icon: "split" as const, title: t("landing.how4Title"), body: t("landing.how4") },
  ];

  return (
    <>
      <section className="wrap hero">
        <div className="hero-copy">
          <p className="kicker">
            {t("landing.kicker")} · {t("beta")}
          </p>
          <h1 className="thesis display">{t("thesis")}</h1>
          <p className="lede">{t("promise")}</p>
          <p className="muted">{t("tagline")}</p>
          <div className="cta-row">
            <Link className="btn" to="/register">
              {t("cta.start")}
            </Link>
            <Link className="btn ghost" to="/agents">
              {t("cta.mcp")}
            </Link>
          </div>
          <ol className="beats">
            <li>{t("landing.beat1")}</li>
            <li>{t("landing.beat2")}</li>
            <li>{t("landing.beat3")}</li>
            <li>{t("landing.beat4")}</li>
          </ol>
        </div>
        <aside className="tape" aria-label={t("landing.tapeTitle")}>
          <header>
            <span>{t("landing.tapeTitle")}</span>
            <span>atlas-cli</span>
          </header>
          <div className="memo-stage">
            <Memo className="memo-breathe" size={92} mood="think" />
          </div>
          <ol>
            {TAPE.map((row, i) => (
              <li key={row.text} style={{ ["--i" as string]: i }}>
                <span className="who">{row.who}</span>
                <span>
                  <span className={`stamp ${row.stamp}`}>{row.stamp}</span> {row.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ padding: "0 18px 18px 32px" }}>
            {t("landing.tapeHint")}
          </p>
        </aside>
      </section>
      <TokenCompare />
      <section className="wrap brief-teaser">
        <div className="brief-teaser-copy">
          <p className="kicker">{t("landing.briefTitle")}</p>
          <h2 className="display">{t("landing.briefBody")}</h2>
          <Link className="btn ghost" to="/register">
            {t("cta.start")}
          </Link>
        </div>
        <pre className="brief-md sample" aria-label={t("landing.briefTitle")}>
          {t("landing.briefSample")}
        </pre>
      </section>
      <section className="wrap grid-how" style={{ paddingBottom: 56 }}>
        <h2 className="sr-only">{t("landing.howTitle")}</h2>
        {how.map((item, i) => (
          <article className="card how-card" key={item.title} style={{ ["--i" as string]: i }}>
            <div className="how-icon">
              <Icon name={item.icon} />
            </div>
            <h3>{item.title}</h3>
            <p className="muted">{item.body}</p>
          </article>
        ))}
      </section>
      <p className="wrap muted" style={{ paddingBottom: 28 }}>
        {t("landing.local")}{" "}
        <Link to="/pricing">{t("nav.pricing")}</Link>
      </p>
    </>
  );
}
