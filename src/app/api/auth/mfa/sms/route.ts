import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { toProblem } from "@/lib/api/problem";
import { COOKIE } from "@/lib/auth/cookies";
import { postAuth } from "@/lib/auth/upstream";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  const mfa = jar.get(COOKIE.mfa)?.value;
  if (!mfa) {
    return NextResponse.json(
      { type: "about:blank", title: "Please sign in", status: 401, detail: "Your sign-in session expired. Please sign in again.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  const { status, data } = await postAuth("/v1/auth/mfa/sms/send", { mfa_token: mfa });
  if (status >= 400) return NextResponse.json(toProblem(status, data), { status });
  const sent = data && typeof data === "object" && "sent_to" in data && typeof data.sent_to === "string" ? data.sent_to : "";
  return NextResponse.json({ sent_to: sent });
}
