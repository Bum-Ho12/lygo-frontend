import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, cookieSecure, persistSession } from "@/lib/auth/cookies";

export async function establishSession(
  tokens: { access_token: string; refresh_token: string; expires_in?: number },
  sharedDevice: boolean,
) {
  const jar = await cookies();
  persistSession(jar, tokens, sharedDevice, randomBytes(32).toString("hex"));
  return NextResponse.json({ ok: true, mfa_required: false });
}

export async function rememberMfa(token: string, sharedDevice: boolean) {
  const jar = await cookies();
  const secure = cookieSecure();
  jar.set(COOKIE.mfa, token, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 5 * 60 });
  if (sharedDevice) {
    jar.set(COOKIE.shared, "1", { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 5 * 60 });
  }
  return NextResponse.json({ ok: true, mfa_required: true });
}
