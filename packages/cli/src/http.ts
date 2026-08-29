import { CSRF_HEADER } from "./constants.js";
import { mergeCookies, parseSetCookieHeaders, serializeCookieHeader, type CookieJar } from "./cookies.js";
import { CliError } from "./errors.js";
import { redactSecrets } from "./redact.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type ApiResponse = {
  status: number;
  ok: boolean;
  body: unknown;
  text: string;
  contentType: string;
};

export type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  /** Statuses the caller handles itself instead of failing. */
  allow?: readonly number[];
};

export function normalizeBaseUrl(input: string): string {
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `http://${input.trim()}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new CliError(`"${input}" is not a valid API URL. Example: --api http://127.0.0.1:3001`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function setCookieHeaders(headers: Headers): string[] {
  const getter = (headers as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getter === "function") return getter.call(headers);
  const single = headers.get("set-cookie");
  return single === null ? [] : [single];
}

function messageFrom(body: unknown, text: string): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    const message = record["message"];
    if (typeof message === "string" && message.trim() !== "") return message.trim();
    const error = record["error"];
    if (typeof error === "string" && error.trim() !== "") return error.trim();
  }
  return text.trim().slice(0, 200) || "no response body";
}

/** Small fetch wrapper with a cookie jar, CSRF handling, and one-line errors. */
export class ApiClient {
  readonly baseUrl: string;
  #cookies: CookieJar = {};
  #csrfToken: string | undefined;
  #agentKey: string | undefined;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  useAgentKey(key: string): void {
    this.#agentKey = key;
  }

  useCsrfToken(token: string): void {
    this.#csrfToken = token;
  }

  get hasSession(): boolean {
    return Object.keys(this.#cookies).length > 0;
  }

  async request(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      accept: "application/json, text/markdown;q=0.9, text/plain;q=0.8",
      ...options.headers,
    };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (this.hasSession) headers["cookie"] = serializeCookieHeader(this.#cookies);
    if (this.#csrfToken && method !== "GET") headers[CSRF_HEADER] = this.#csrfToken;
    if (this.#agentKey) headers["authorization"] = `Bearer ${this.#agentKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new CliError(
        `Cannot reach the ContextOS API at ${this.baseUrl} (${cause}). Start it with "npm run dev:api" or pass --api.`,
      );
    }

    this.#cookies = mergeCookies(this.#cookies, parseSetCookieHeaders(setCookieHeaders(response.headers)));

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    let body: unknown = text;
    if (contentType.includes("json") && text !== "") {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }

    const result: ApiResponse = { status: response.status, ok: response.ok, body, text, contentType };
    if (!response.ok && !(options.allow ?? []).includes(response.status)) {
      throw new CliError(
        redactSecrets(`ContextOS API ${response.status} on ${method} ${path}: ${messageFrom(body, text)}`),
      );
    }
    return result;
  }

  get(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.request("GET", path, options);
  }

  post(path: string, body: unknown, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.request("POST", path, { ...options, body });
  }
}
