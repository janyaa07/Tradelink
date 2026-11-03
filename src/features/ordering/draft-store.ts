import "server-only";
import { callRpc } from "@/data/rpc";
import { mergeLines } from "@/domain/review";
import type { ActionResult } from "@/lib/errors";
import type { DraftLine } from "./draft";
import { readDraft } from "./queries";

const MAX_LINES = 60;
const ATTEMPTS = 2;

export type NewDraftLine = {
  productId: string;
  qty: number;
  sourceText: string;
  state: "suggested" | "manual";
  options?: string[];
};

function toDraftLine(line: NewDraftLine): DraftLine {
  return {
    id: crypto.randomUUID(),
    sourceText: line.sourceText.slice(0, 240),
    productId: line.productId,
    qty: line.qty,
    kg: null,
    qtyAssumed: false,
    options: (line.options ?? []).slice(0, 5),
    state: line.state,
  };
}

/**
 * Adds lines to the buyer's saved draft from outside the review screen (usuals, Ready for
 * tomorrow, Availability). A product already in the draft gets the extra quantity. If another
 * tab saved first, the draft is read again and the merge retried once.
 */
export async function addLinesToDraft(userId: string, incoming: NewDraftLine[]): Promise<ActionResult<{ version: number }>> {
  let result: ActionResult<{ version: number }> = { ok: false, error: "Something went wrong. Try again." };
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const draft = await readDraft(userId);
    const lines = mergeLines(draft.lines, incoming.map(toDraftLine));
    if (lines.length > MAX_LINES) {
      return { ok: false, error: `An order can have up to ${MAX_LINES} lines. Place or remove some lines first.` };
    }
    result = await callRpc<{ version: number }>("save_draft", { p_lines: lines, p_version: draft.version });
    if (result.ok || result.reason !== "STALE_DRAFT") return result;
  }
  return result;
}
