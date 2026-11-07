import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Real requests always carry a Host header; NextRequest doesn't derive it from the URL.
const req = (url: string, cookie?: string) => {
  const headers: Record<string, string> = { host: new URL(url).host };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(url, { headers });
};

describe("middleware", () => {
  it("lets public paths through", () => {
    const res = middleware(req("http://localhost:3000/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated users to /login with next param", () => {
    const res = middleware(req("http://localhost:3000/f/acme/workspace"));
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/f/acme/workspace");
  });

  it("allows authenticated users", () => {
    const res = middleware(req("http://localhost:3000/f/acme/workspace", "lygo_session=x"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("rewrites firm subdomains to /f/<slug>/portal", () => {
    const res = middleware(req("http://acme.localhost:3000/"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/f/acme/portal");
  });
});
