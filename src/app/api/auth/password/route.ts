import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { COOKIE } from "@/lib/auth/cookies";
import { establishSession } from "@/lib/auth/session";
import { postWithAccess, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { current_password?: string; new_password?: string };
  const jar = await cookies();
  const access = jar.get(COOKIE.access)?.value;
  if (!access) {
    return NextResponse.json(
      { type: "about:blank", title: "Please sign in", status: 401, detail: "Please sign in to continue.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  const { status, data } = await postWithAccess("/v1/me/password", access, {
    current_password: body.current_password ?? "",
    new_password: body.new_password ?? "",
  });
  const tokens = status < 400 ? tokenPair(data) : null;
  if (!tokens) return NextResponse.json(toProblem(status, data), { status: status || 401 });
  const shared = jar.get(COOKIE.shared)?.value === "1";
  return establishSession(tokens, shared);
}
