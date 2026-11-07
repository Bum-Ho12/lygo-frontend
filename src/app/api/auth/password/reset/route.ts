import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { postAuth } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; new_password?: string };
  const { status, data } = await postAuth("/v1/auth/password/reset", {
    token: body.token ?? "",
    new_password: body.new_password ?? "",
  });
  if (status >= 400) return NextResponse.json(toProblem(status, data), { status });
  return new NextResponse(null, { status: 204 });
}
