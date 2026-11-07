import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { postAuth } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const { status, data } = await postAuth("/v1/auth/password/forgot", { email: body.email ?? "" });
  if (status >= 400) return NextResponse.json(toProblem(status, data), { status });
  return NextResponse.json({
    status: "If an account exists for that address, a reset link has been sent.",
  });
}
