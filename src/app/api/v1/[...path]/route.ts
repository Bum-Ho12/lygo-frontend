import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { apiUrl } from "@/lib/api/backend";
import { COOKIE, clearSession, persistSession, slideSession } from "@/lib/auth/cookies";
import { postAuth, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

function safePath(parts: string[]): string | null {
  if (parts.length === 0) return null;
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return null;
  }
  return `/${parts.map((part) => encodeURIComponent(part).replace(/%3A/gi, ":")).join("/")}`;
}

function isPublic(method: string, parts: string[]): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return parts[0] === "health" || parts[0] === "corpus" || (parts.length === 1 && parts[0] === "firm-signup");
}

function csrfOk(header: string | null, cookie: string | undefined): boolean {
  if (!header || !cookie) return false;
  const left = Buffer.from(header);
  const right = Buffer.from(cookie);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

let refreshFlight: Promise<string | null> | null = null;

async function refreshedToken(): Promise<string | null> {
  if (!refreshFlight) {
    refreshFlight = (async () => {
      const jar = await cookies();
      const refresh = jar.get(COOKIE.refresh)?.value;
      if (!refresh) return null;
      const shared = jar.get(COOKIE.shared)?.value === "1";
      const { status, data } = await postAuth("/v1/auth/refresh", { refresh_token: refresh });
      const tokens = status < 400 ? tokenPair(data) : null;
      if (!tokens) {
        clearSession(jar);
        return null;
      }
      persistSession(jar, tokens, shared, jar.get(COOKIE.csrf)?.value || randomBytes(32).toString("hex"));
      return tokens.access_token;
    })().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}

async function forward(req: NextRequest, parts: string[]) {
  if (parts[0] === "auth") {
    return NextResponse.json({ type: "about:blank", title: "Not found", status: 404 }, { status: 404 });
  }
  const path = safePath(parts);
  if (!path) return NextResponse.json({ type: "about:blank", title: "Bad path", status: 400 }, { status: 400 });

  const method = req.method.toUpperCase();
  const jar = await cookies();
  const publicRoute = isPublic(method, parts);
  let access = jar.get(COOKIE.access)?.value ?? null;
  if (!publicRoute && !access) access = await refreshedToken();
  if (!publicRoute && !access) {
    clearSession(jar);
    return NextResponse.json(
      { type: "about:blank", title: "Please sign in", status: 401, detail: "Please sign in to continue.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  if (!publicRoute && method !== "GET" && method !== "HEAD" && !csrfOk(req.headers.get("x-csrf-token"), jar.get(COOKIE.csrf)?.value)) {
    return NextResponse.json(
      { type: "about:blank", title: "Please refresh the page", status: 403, detail: "Please refresh the page and try again.", code: "csrf" },
      { status: 403 },
    );
  }

  const headers = new Headers();
  if (access) headers.set("Authorization", `Bearer ${access}`);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const idempotency = req.headers.get("idempotency-key");
  if (idempotency) headers.set("Idempotency-Key", idempotency);

  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;
  const url = `${apiUrl(path)}${req.nextUrl.search}`;
  const send = (token: string | null) => {
    const nextHeaders = new Headers(headers);
    if (token) nextHeaders.set("Authorization", `Bearer ${token}`);
    else nextHeaders.delete("Authorization");
    return fetch(url, { method, headers: nextHeaders, body, cache: "no-store" });
  };

  let upstream: Response;
  try {
    upstream = await send(access);
    if (upstream.status === 401 && !publicRoute) {
      const token = await refreshedToken();
      if (token) upstream = await send(token);
    }
  } catch {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Lygo isn't available right now",
        status: 503,
        detail: "Please try again in a moment.",
        code: "api_unavailable",
      },
      { status: 503 },
    );
  }

  if (upstream.status === 401) clearSession(await cookies());
  else if (!publicRoute && upstream.ok) slideSession(await cookies());

  const responseHeaders = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) responseHeaders.set("Content-Type", type);
  if (type?.includes("text/event-stream")) {
    responseHeaders.set("Cache-Control", "no-cache, no-transform");
    responseHeaders.set("X-Accel-Buffering", "no");
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

async function handle(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return forward(req, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
