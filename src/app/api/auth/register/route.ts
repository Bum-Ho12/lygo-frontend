import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { establishSession } from "@/lib/auth/session";
import { postAuth, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

const FIELDS = ["name", "email", "password", "phone", "invitation_token"] as const;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = body[field];
    if (typeof value === "string" && value.trim()) payload[field] = value.trim();
  }
  const { status, data } = await postAuth("/auth/register", payload);
  const tokens = status < 400 ? tokenPair(data) : null;
  if (tokens) return establishSession(tokens, false);
  if (status >= 400) return NextResponse.json(toProblem(status, data), { status });
  const rest: Record<string, unknown> = data && typeof data === "object" ? { ...(data as Record<string, unknown>) } : { ok: true };
  delete rest.access_token;
  delete rest.refresh_token;
  delete rest.mfa_token;
  return NextResponse.json(rest, { status });
}
