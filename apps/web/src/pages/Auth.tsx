import { useState, type FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { Memo } from "../mascot/Memo";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuthed } = useAuth();
  const [search] = useSearchParams();
  const demo = search.get("demo") === "1";
  const [email, setEmail] = useState(demo ? "demo@contextos.dev" : "");
  const [password, setPassword] = useState(demo ? "DemoPassw0rd!" : "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (demo && mode === "login") {
      void (async () => {
        setPending(true);
        try {
          await api("/api/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: "demo@contextos.dev", password: "DemoPassw0rd!" }),
          });
          setAuthed(true);
          navigate("/app");
        } catch {
          setPending(false);
        }
      })();
    }
  }, [demo, mode, navigate, setAuthed]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError(t("auth.invalidEmail"));
      return;
    }
    if (password.length < 10) {
      setError(t("auth.weakPassword"));
      return;
    }
    setPending(true);
    try {
      if (mode === "register") {
        await api("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, name: name || email.split("@")[0] }),
        });
      } else {
        await api("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      setAuthed(true);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap auth-split">
      <div className="auth-stage">
        <div className="auth-copy">
          <Memo className="memo-breathe" size={108} mood={mode === "register" ? "wave" : "idle"} />
          <p className="kicker">{t("beta")}</p>
          <h2>{t("auth.asideTitle")}</h2>
          <p className="muted">{t("auth.asideBody")}</p>
        </div>
      </div>
      <div className="auth-form">
        <h1>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</h1>
        <form className="stack" onSubmit={onSubmit} noValidate>
          {mode === "register" ? (
            <label>
              <span>{t("auth.name")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="register-name" />
            </label>
          ) : null}
          <label>
            <span>{t("auth.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(error)}
              required
              data-testid="auth-email"
            />
          </label>
          <label>
            <span>{t("auth.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-invalid={Boolean(error)}
              required
              data-testid="auth-password"
            />
          </label>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn" disabled={pending} type="submit" data-testid="auth-submit">
            {mode === "login" ? t("auth.submitLogin") : t("auth.submitRegister")}
          </button>
          {mode === "login" ? (
            <p className="muted" style={{ margin: 0 }}>
              {t("auth.demoHint")}{" "}
              <Link to="/login?demo=1" data-testid="demo-login">
                {t("cta.demo")}
              </Link>
            </p>
          ) : null}
        </form>
        <p style={{ marginTop: 16 }}>
          {mode === "login" ? (
            <>
              {t("auth.noAccount")} <Link to="/register">{t("nav.register")}</Link>
            </>
          ) : (
            <>
              {t("auth.hasAccount")} <Link to="/login">{t("nav.login")}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
