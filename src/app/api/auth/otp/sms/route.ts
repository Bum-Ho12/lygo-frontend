import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { establishSession } from "@/lib/auth/session";
import { postAuth, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const payload: { phone?: string; code?: string } = {};
  if (body.phone) payload.phone = body.phone;
  if (body.code) payload.code = body.code;
  const { status, data } = await postAuth("/auth/otp/sms", payload);
  const tokens = status < 400 ? tokenPair(data) : null;
  if (tokens) return establishSession(tokens, false);
  if (status >= 400) return NextResponse.json(toProblem(status, data), { status });
  const rest: Record<string, unknown> = data && typeof data === "object" ? { ...(data as Record<string, unknown>) } : { ok: true };
  delete rest.access_token;
  delete rest.refresh_token;
  return NextResponse.json(rest, { status });
}
