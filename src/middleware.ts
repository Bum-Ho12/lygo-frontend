import { NextResponse, type NextRequest } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const PUBLIC_PATHS = ["/", "/login", "/register", "/invite", "/accept-invite", "/mfa", "/forgot-password", "/reset-password", "/register-firm", "/pitch", "/pitch.html"];

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (url.pathname.startsWith("/api/")) return NextResponse.next();

  const host = req.headers.get("host")?.split(":")[0] ?? "";
  let rewrote = false;
  if (host.endsWith(`.${ROOT_DOMAIN}`) && host !== ROOT_DOMAIN && !url.pathname.startsWith("/f/")) {
    const firmSlug = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (firmSlug && !firmSlug.includes(".")) {
      url.pathname = `/f/${firmSlug}${url.pathname === "/" ? "/portal" : url.pathname}`;
      rewrote = true;
    }
  }

  const isPublic = PUBLIC_PATHS.some((path) => url.pathname === path || (path !== "/" && url.pathname.startsWith(`${path}/`)));
  if (!isPublic && !req.cookies.get("lygo_session")) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return rewrote ? NextResponse.rewrite(url) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
