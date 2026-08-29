import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { i18n } from "../i18n";
import { Icon } from "../components/Icons";
import { PageHead } from "../components/PageHead";

type User = { id: string; email: string; name: string; language: string; theme: string };

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { setAuthed } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void api<{ user: User }>("/api/v1/auth/me").then((r) => {
      setUser(r.user);
      setName(r.user.name);
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ name, language: i18n.language, theme }),
    });
    setMsg(t("app.saved"));
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    await api("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setMsg(t("app.passwordUpdated"));
  }

  async function logout() {
    await api("/api/v1/auth/logout", { method: "POST" });
    setAuthed(false);
    navigate("/");
  }

  async function exportMe() {
    const data = await api("/api/v1/auth/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contextos-account.json";
    a.click();
  }

  async function destroy() {
    if (!confirm(t("ui.deleteAccountConfirm"))) return;
    await api("/api/v1/auth/me", { method: "DELETE" });
    navigate("/");
  }

  if (!user) {
    return <p className="wrap loader">{t("app.loading")}</p>;
  }

  return (
    <div className="wrap" style={{ maxWidth: 580, padding: "40px 0" }}>
      <PageHead title={t("app.settings")} />
      {msg ? <p role="status">{msg}</p> : null}
      <form className="card stack" onSubmit={save}>
        <label>
          <span>{t("auth.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>{t("app.language")}</span>
          <select
            value={i18n.language}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value);
              localStorage.setItem("cos_lang", e.target.value);
            }}
          >
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </select>
        </label>
        <label>
          <span>{t("app.theme")}</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}>
            <option value="system">{t("app.themeSystem")}</option>
            <option value="light">{t("app.themeLight")}</option>
            <option value="dark">{t("app.themeDark")}</option>
          </select>
        </label>
        <button className="btn" type="submit">
          {t("app.save")}
        </button>
      </form>
      <form className="card stack section-card" onSubmit={changePassword}>
        <label>
          <span>{t("app.currentPassword")}</span>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </label>
        <label>
          <span>{t("app.newPassword")}</span>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          {t("app.changePassword")}
        </button>
      </form>
      <div className="row" style={{ marginTop: 28 }}>
        <button className="btn ghost" type="button" onClick={() => void exportMe()}>
          <Icon name="export" size={15} />
          {t("app.export")}
        </button>
        <button className="btn ghost" type="button" onClick={() => void logout()}>
          <Icon name="logout" size={15} />
          {t("app.signOut")}
        </button>
        <button className="btn danger" type="button" onClick={() => void destroy()}>
          {t("app.deleteAccount")}
        </button>
      </div>
    </div>
  );
}
