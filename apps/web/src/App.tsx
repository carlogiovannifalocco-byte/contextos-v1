import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./auth";
import { PublicHeader } from "./components/PublicHeader";
import { Landing } from "./pages/Landing";
import { AuthPage } from "./pages/Auth";
import { AgentsHub } from "./pages/AgentsHub";
import { ChangelogPage, NotFound, PrivacyPage, TermsPage } from "./pages/Legal";
import { PricingPage } from "./pages/Pricing";
import { AppHome } from "./pages/AppHome";
import { WorkspaceLayout } from "./pages/WorkspaceLayout";
import {
  ActivityPage,
  AgentsPage,
  MemoryPage,
  OverviewPage,
  ProjectPrivacyPage,
  TasksPage,
} from "./pages/WorkspacePages";
import { BriefPage } from "./pages/BriefPage";
import { SettingsPage } from "./pages/Settings";

function PublicShell({ authed }: { authed: boolean }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const hideHeader = loc.pathname.startsWith("/p/");
  return (
    <>
      {!hideHeader ? <PublicHeader authed={authed} /> : null}
      <main id="main">
        <Outlet />
      </main>
      {!hideHeader ? (
        <footer className="footer wrap">
          <span>{t("beta")}</span>
          <span>
            <Link to="/privacy">{t("nav.privacy")}</Link> · <Link to="/terms">{t("nav.terms")}</Link> · MIT
          </span>
        </footer>
      ) : null}
    </>
  );
}

function Guard({ authed, children }: { authed: boolean | null; children: ReactNode }) {
  const { t } = useTranslation();
  if (authed === null) {
    return <p className="wrap loader">{t("app.loading")}</p>;
  }
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  const { authed } = useAuth();

  return (
    <Routes>
      <Route element={<PublicShell authed={Boolean(authed)} />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/agents" element={<AgentsHub />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/app"
          element={
            <Guard authed={authed}>
              <AppHome />
            </Guard>
          }
        />
        <Route
          path="/settings"
          element={
            <Guard authed={authed}>
              <SettingsPage />
            </Guard>
          }
        />
        <Route
          path="/p/:projectId"
          element={
            <Guard authed={authed}>
              <WorkspaceLayout />
            </Guard>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="brief" element={<BriefPage />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="privacy" element={<ProjectPrivacyPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
