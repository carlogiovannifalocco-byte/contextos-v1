import { describe, expect, it } from "vitest";
import { mergeCookies, parseSetCookieHeaders, serializeCookieHeader } from "./cookies.js";

describe("parseSetCookieHeaders", () => {
  it("takes the name and value and drops the attributes", () => {
    expect(
      parseSetCookieHeaders([
        "contextos_session=abc123; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600",
        "other=1; Path=/",
      ]),
    ).toEqual({ contextos_session: "abc123", other: "1" });
  });

  it("skips malformed headers", () => {
    expect(parseSetCookieHeaders(["", "novalue", "=orphan"])).toEqual({});
  });
});

describe("mergeCookies", () => {
  it("adds and replaces cookies", () => {
    const jar = mergeCookies({ contextos_session: "old" }, { contextos_session: "new", extra: "1" });
    expect(jar).toEqual({ contextos_session: "new", extra: "1" });
  });

  it("drops a cookie the server cleared", () => {
    expect(mergeCookies({ contextos_session: "old" }, { contextos_session: "" })).toEqual({});
  });
});

describe("serializeCookieHeader", () => {
  it("joins the jar the way a browser would", () => {
    expect(serializeCookieHeader({ a: "1", b: "2" })).toBe("a=1; b=2");
    expect(serializeCookieHeader({})).toBe("");
  });
});
