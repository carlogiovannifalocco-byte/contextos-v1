import { describe, expect, it } from "vitest";
import { API_CSP, DOCS_CSP, contentSecurityPolicyForUrl } from "../src/lib/csp.js";

describe("CSP", () => {
  it("locks JSON routes to default-src none", () => {
    expect(contentSecurityPolicyForUrl("/api/health")).toBe(API_CSP);
    expect(contentSecurityPolicyForUrl("/api/v1/projects")).toBe(API_CSP);
    expect(API_CSP).toMatch(/default-src 'none'/);
    expect(API_CSP).toMatch(/frame-ancestors 'none'/);
  });

  it("allows Swagger scripts and styles only under /api/docs", () => {
    expect(contentSecurityPolicyForUrl("/api/docs")).toBe(DOCS_CSP);
    expect(contentSecurityPolicyForUrl("/api/docs/static/swagger-ui.css")).toBe(DOCS_CSP);
    expect(DOCS_CSP).toMatch(/script-src 'self'/);
    expect(DOCS_CSP).toMatch(/style-src 'self'/);
  });
});
