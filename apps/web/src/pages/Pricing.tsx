import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function PricingPage() {
  const { t } = useTranslation();
  const tiers = [
    { key: "self", featured: true },
    { key: "team", featured: false },
    { key: "cloud", featured: false },
  ] as const;

  return (
    <div className="wrap" style={{ padding: "40px 0 80px" }}>
      <p className="kicker">{t("pricing.kicker")}</p>
      <h1 className="display" style={{ maxWidth: "18ch" }}>
        {t("pricing.title")}
      </h1>
      <p className="lede muted" style={{ maxWidth: "52ch" }}>
        {t("pricing.lead")}
      </p>
      <div className="grid-how" style={{ marginTop: 32 }}>
        {tiers.map((tier) => (
          <article key={tier.key} className={`card how-card ${tier.featured ? "rail" : ""}`} style={tier.featured ? { ["--rail" as string]: "var(--ion)" } : undefined}>
            <p className="kicker">{t(`pricing.${tier.key}Kicker`)}</p>
            <h2>{t(`pricing.${tier.key}Title`)}</h2>
            <p className="display" style={{ fontSize: "2rem", margin: "8px 0" }}>
              {t(`pricing.${tier.key}Price`)}
            </p>
            <p className="muted">{t(`pricing.${tier.key}Body`)}</p>
            <ul className="beats" style={{ marginTop: 16 }}>
              <li>{t(`pricing.${tier.key}F1`)}</li>
              <li>{t(`pricing.${tier.key}F2`)}</li>
              <li>{t(`pricing.${tier.key}F3`)}</li>
            </ul>
          </article>
        ))}
      </div>
      <div className="cta-row" style={{ marginTop: 32 }}>
        <Link className="btn" to="/register">
          {t("cta.start")}
        </Link>
        <Link className="btn ghost" to="/agents">
          {t("cta.mcp")}
        </Link>
      </div>
    </div>
  );
}
