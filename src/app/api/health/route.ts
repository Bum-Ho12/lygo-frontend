import { NextResponse } from "next/server";

// Liveness probe for RumptyCloud. Excluded from the auth gate in middleware.ts.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version: process.env.APP_VERSION ?? "dev",
    time: new Date().toISOString(),
  });
}
