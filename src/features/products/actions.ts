"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { requireRole } from "@/data/session";
import { MAX_LINE_QTY } from "@/domain/review";
import { readDraft } from "@/features/ordering/queries";
import type { ActionResult } from "@/lib/errors";
import { productQuantity, setProductQuantity } from "./cart";

const MAX_LINES = 60;
const ATTEMPTS = 2;

const inputSchema = z.object({
  productId: z.uuid(),
  qty: z.number().int().min(0).max(MAX_LINE_QTY),
});

export type CartChange = {
  /** The product's quantity in the cart after the change. */
  qty: number;
  /** The number of cart lines after the change. */
  lines: number;
};

/**
 * Add to cart and the card stepper: sets one product's total quantity in the buyer's cart (the
 * order draft), removing it at 0. If another tab saved first, the draft is read again and the
 * change retried once.
 */
export async function setCartQuantityAction(productId: string, qty: number): Promise<ActionResult<CartChange>> {
  const session = await requireRole("buyer");
  const parsed = inputSchema.safeParse({ productId, qty });
  if (!parsed.success) return { ok: false, error: "Check the details and try again." };

  let result: ActionResult<CartChange> = { ok: false, error: "Something went wrong. Try again." };
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const draft = await readDraft(session.userId);
    const lines = setProductQuantity(draft.lines, parsed.data.productId, parsed.data.qty, crypto.randomUUID());
    if (lines === draft.lines) return { ok: true, data: { qty: parsed.data.qty, lines: lines.length } };
    if (lines.length > MAX_LINES) {
      return { ok: false, error: `The cart can have up to ${MAX_LINES} lines. Place or remove some lines first.` };
    }
    const saved = await callRpc<{ version: number }>("save_draft", { p_lines: lines, p_version: draft.version });
    if (saved.ok) {
      revalidatePath("/buyer", "layout");
      return { ok: true, data: { qty: productQuantity(lines, parsed.data.productId), lines: lines.length } };
    }
    result = saved;
    if (saved.reason !== "STALE_DRAFT") return saved;
  }
  return result;
}
