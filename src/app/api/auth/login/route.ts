import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { establishSession, rememberMfa } from "@/lib/auth/session";
import { mfaChallenge, mfaMethods, postAuth, tokenPair } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    shared_device?: boolean;
  };
  const shared = Boolean(body.shared_device);
  const { status, data } = await postAuth("/auth/login", {
    email: body.email ?? "",
    password: body.password ?? "",
  });
  const tokens = status < 400 ? tokenPair(data) : null;
  if (tokens) return establishSession(tokens, shared);
  const challenge = status < 400 ? mfaChallenge(data) : null;
  if (challenge) return rememberMfa(challenge, mfaMethods(data), shared);
  return NextResponse.json(toProblem(status, data), { status: status || 401 });
}
