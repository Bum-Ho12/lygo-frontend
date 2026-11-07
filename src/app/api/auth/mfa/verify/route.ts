import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { COOKIE, cookieSecure, persistSession } from "@/lib/auth/cookies";
import { postAuth, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const jar = await cookies();
  const mfa = jar.get(COOKIE.mfa)?.value;
  if (!mfa || !body.code) {
    return NextResponse.json({ type: "about:blank", title: "Code required", status: 400 }, { status: 400 });
  }
  const shared = jar.get(COOKIE.shared)?.value === "1";
  const { status, data } = await postAuth("/auth/mfa/verify", { mfa_token: mfa, code: body.code });
  const tokens = status < 400 ? tokenPair(data) : null;
  if (!tokens) return NextResponse.json(toProblem(status, data), { status: status || 401 });
  persistSession(jar, tokens, shared, randomBytes(32).toString("hex"));
  jar.set(COOKIE.mfa, "", { path: "/", httpOnly: true, sameSite: "lax", secure: cookieSecure(), maxAge: 0 });
  return NextResponse.json({ ok: true, mfa_required: false });
}
