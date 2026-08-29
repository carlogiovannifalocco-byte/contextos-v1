export type CookieJar = Readonly<Record<string, string>>;

/** Take the `name=value` pair out of each Set-Cookie header, ignoring attributes. */
export function parseSetCookieHeaders(headers: readonly string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of headers) {
    const pair = header.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    if (!name) continue;
    cookies[name] = pair.slice(eq + 1).trim();
  }
  return cookies;
}

/** Apply new cookies to the jar. An empty value means the server cleared it. */
export function mergeCookies(jar: CookieJar, incoming: Readonly<Record<string, string>>): CookieJar {
  const next: Record<string, string> = { ...jar };
  for (const [name, value] of Object.entries(incoming)) {
    if (value === "") delete next[name];
    else next[name] = value;
  }
  return next;
}

export function serializeCookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
