import "server-only";
import { callRpc } from "@/data/rpc";
import { mergeLines } from "@/domain/review";
import type { ActionResult } from "@/lib/errors";
import type { DraftLine, DraftState } from "./draft";
import { readDraft } from "./queries";

const MAX_LINES = 60;
const ATTEMPTS = 2;

/** A line to add. A null product is kept as a line to resolve in the cart ("check" or "not_found"). */
export type NewDraftLine = {
  productId: string | null;
  qty: number;
  sourceText: string;
  state: DraftState;
  options?: string[];
  kg?: number | null;
  qtyAssumed?: boolean;
};

function toDraftLine(line: NewDraftLine): DraftLine {
  return {
    id: crypto.randomUUID(),
    sourceText: line.sourceText.slice(0, 240),
    productId: line.productId,
    qty: line.qty,
    kg: line.kg ?? null,
    qtyAssumed: line.qtyAssumed ?? false,
    options: (line.options ?? []).slice(0, 5),
    state: line.state,
  };
}

/**
 * Adds lines to the buyer's saved draft (the cart) from outside the cart screen (Assistant, usuals,
 * Ready for tomorrow, Products). A product already in the draft gets the extra quantity. If another
 * tab saved first, the draft is read again and the merge retried once.
 */
export async function addLinesToDraft(userId: string, incoming: NewDraftLine[]): Promise<ActionResult<{ version: number }>> {
  let result: ActionResult<{ version: number }> = { ok: false, error: "Something went wrong. Try again." };
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const draft = await readDraft(userId);
    const lines = mergeLines(draft.lines, incoming.map(toDraftLine));
    if (lines.length > MAX_LINES) {
      return { ok: false, error: `The cart can have up to ${MAX_LINES} lines. Place or remove some lines first.` };
    }
    result = await callRpc<{ version: number }>("save_draft", { p_lines: lines, p_version: draft.version });
    if (result.ok || result.reason !== "STALE_DRAFT") return result;
  }
  return result;
}
