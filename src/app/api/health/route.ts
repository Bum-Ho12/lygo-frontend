import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api/backend";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await fetch(apiUrl("/v1/health"), { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text || JSON.stringify({ status: "unknown" }), {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ status: "unreachable" }, { status: 503 });
  }
}
