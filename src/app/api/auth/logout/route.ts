import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSession, COOKIE } from "@/lib/auth/cookies";
import { postAuth } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  const refresh = jar.get(COOKIE.refresh)?.value;
  if (refresh) await postAuth("/auth/logout", { refresh_token: refresh });
  clearSession(jar);
  return NextResponse.json({ ok: true });
}
