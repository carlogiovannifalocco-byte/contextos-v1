import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

const AuthContext = createContext<{
  authed: boolean | null;
  refresh: () => Promise<void>;
  setAuthed: (v: boolean) => void;
}>({ authed: null, refresh: async () => undefined, setAuthed: () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ authenticated: boolean }>("/api/v1/auth/status");
      setAuthed(r.authenticated);
    } catch {
      setAuthed(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ authed, refresh, setAuthed }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
