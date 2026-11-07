import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { COOKIE } from "@/lib/auth/cookies";
import { establishSession } from "@/lib/auth/session";
import { postWithAccess, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const jar = await cookies();
  const access = jar.get(COOKIE.access)?.value;
  if (!access) {
    return NextResponse.json(
      { type: "about:blank", title: "Please sign in", status: 401, detail: "Please sign in to continue.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  const { status, data } = await postWithAccess("/v1/me/mfa/totp/confirm", access, { code: body.code ?? "" });
  const tokens = status < 400 ? tokenPair(data) : null;
  if (!tokens) return NextResponse.json(toProblem(status, data), { status: status || 401 });
  const record = data && typeof data === "object" ? (data as { recovery_codes?: unknown }) : {};
  const codes = Array.isArray(record.recovery_codes) ? record.recovery_codes.filter((item): item is string => typeof item === "string") : [];
  const shared = jar.get(COOKIE.shared)?.value === "1";
  const response = await establishSession(tokens, shared);
  const payload = (await response.json()) as Record<string, unknown>;
  return NextResponse.json({ ...payload, recovery_codes: codes });
}
