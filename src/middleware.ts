import { NextResponse, type NextRequest } from "next/server";

// See docs/03-routing-and-tenancy.md. Convenience gate only — the API enforces access.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const PUBLIC_PATHS = ["/", "/login", "/invite", "/mfa"];

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get("host")?.split(":")[0] ?? "";

  // <firmSlug>.<root domain> → /f/<firmSlug>/...
  if (host.endsWith(`.${ROOT_DOMAIN}`) && !url.pathname.startsWith("/f/")) {
    const firmSlug = host.slice(0, -(ROOT_DOMAIN.length + 1));
    url.pathname = `/f/${firmSlug}${url.pathname === "/" ? "/portal" : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  // TODO: custom firm domains → lookup firmSlug via API (cached).

  const isPublic = PUBLIC_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
  if (!isPublic && !req.cookies.get("lygo_session")) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", url.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
