/** JSON API: deny by default. Swagger UI at /api/docs needs scripts and styles from self. */
export const API_CSP =
  "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'";

export const DOCS_CSP =
  "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'";

export function contentSecurityPolicyForUrl(url: string): string {
  const path = url.split("?")[0] ?? url;
  return path.startsWith("/api/docs") ? DOCS_CSP : API_CSP;
}
