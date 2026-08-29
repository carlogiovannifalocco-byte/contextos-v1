const CSRF_KEY = "cos_csrf";

export function apiBase() {
  return import.meta.env.VITE_API_BASE ?? "";
}

export function getCsrf() {
  return sessionStorage.getItem(CSRF_KEY) ?? "";
}

export function setCsrf(token: string) {
  sessionStorage.setItem(CSRF_KEY, token);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCsrf();
    if (csrf) headers.set("x-csrf-token", csrf);
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { csrfToken?: string; message?: string; error?: string }) : ({} as T);
  if (data && typeof data === "object" && "csrfToken" in data && data.csrfToken) {
    setCsrf(String(data.csrfToken));
  }
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message || res.statusText);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return data;
}

/** For endpoints that answer with text (the markdown context brief), not JSON. */
export async function apiText(path: string): Promise<string> {
  const res = await fetch(`${apiBase()}${path}`, { credentials: "include" });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(res.statusText);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return text;
}

export async function ensureCsrf() {
  if (getCsrf()) return;
  try {
    const res = await api<{ csrfToken: string }>("/api/v1/auth/csrf");
    setCsrf(res.csrfToken);
  } catch {
    /* unauthenticated */
  }
}
