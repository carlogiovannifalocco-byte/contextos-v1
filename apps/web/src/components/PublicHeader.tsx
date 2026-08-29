import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Memo } from "../mascot/Memo";
import { Icon } from "./Icons";
import { i18n } from "../i18n";
import { useTheme } from "../theme";

export function PublicHeader({ authed }: { authed: boolean }) {
  const { t } = useTranslation();
  const { resolved, setTheme } = useTheme();

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <Memo size={40} mood="idle" />
        <span>
          ContextOS
          <small>SHARED BRAIN</small>
        </span>
      </Link>
      <nav className="nav" aria-label="Primary">
        <NavLink to="/agents">{t("nav.agents")}</NavLink>
        <NavLink to="/pricing">{t("nav.pricing")}</NavLink>
        <NavLink to="/changelog">{t("nav.changelog")}</NavLink>
        <a href="https://github.com/carlogiovannifalocco-byte/contextos-v1" rel="noreferrer" target="_blank">
          GitHub
        </a>
        <a href="/api/docs">{t("nav.docs")}</a>
        <button
          className="icon-btn"
          type="button"
          aria-label={resolved === "dark" ? t("ui.themeLight") : t("ui.themeDark")}
          onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        >
          <Icon name={resolved === "dark" ? "sun" : "moon"} size={16} />
        </button>
        <button
          className="btn ghost btn-sm"
          type="button"
          onClick={() => {
            const next = i18n.language === "it" ? "en" : "it";
            void i18n.changeLanguage(next);
            localStorage.setItem("cos_lang", next);
          }}
        >
          {i18n.language === "it" ? "EN" : "IT"}
        </button>
        {authed ? (
          <Link className="btn" to="/app">
            {t("nav.app")}
          </Link>
        ) : (
          <>
            <Link to="/login">{t("nav.login")}</Link>
            <Link className="btn" to="/register">
              {t("nav.register")}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
