import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness check with no dependencies (ADR 0017). */
export function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
