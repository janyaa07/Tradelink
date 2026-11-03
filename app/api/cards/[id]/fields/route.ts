import { NextResponse, type NextRequest } from "next/server";
import { reviseCardFields } from "@/features/cards/act";
import { messageFor } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Edited fields on a card: { subjectVersion, clientActionId, changes: [{ lineId, qty }] } (section 4.5). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (body === null) return NextResponse.json({ ok: false, error: messageFor("INVALID_INPUT") }, { status: 400 });
  const { status, body: result } = await reviseCardFields(id, body);
  return NextResponse.json(result, { status });
}
