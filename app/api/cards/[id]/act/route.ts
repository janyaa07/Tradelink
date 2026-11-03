import { NextResponse, type NextRequest } from "next/server";
import { actOnCard } from "@/features/cards/act";
import { messageFor } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** A tap on a card button: { action, subjectVersion, clientActionId, input? } (docs/PLAN.md, section 4.4). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (body === null) return NextResponse.json({ ok: false, error: messageFor("INVALID_INPUT") }, { status: 400 });
  const { status, body: result } = await actOnCard(id, body);
  return NextResponse.json(result, { status });
}
