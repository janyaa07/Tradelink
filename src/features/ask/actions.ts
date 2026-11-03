"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/data/session";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ASK_COPY, textReply } from "@/domain/ask/replies";
import type { AskReply, AskTurn, CartLine } from "@/domain/ask/types";
import { checkLines } from "@/domain/review";
import { getBuyerCatalogue } from "@/features/buyer/queries";
import { placeOrdersAction, type PlacedOrders } from "@/features/ordering/actions";
import { DRAFT_STATES } from "@/features/ordering/draft";
import { addLinesToDraft } from "@/features/ordering/draft-store";
import { readDraft } from "@/features/ordering/queries";
import type { ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { linesForCatalogue } from "./cart-lines";
import { respondToAsk } from "./respond";

const MAX_CHARS = 2000;
const MAX_TURNS = 20;
const ASK_LIMIT_PER_HOUR = 60;

const askSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHARS),
  history: z.array(z.object({ role: z.enum(["buyer", "tradelink"]), text: z.string().max(MAX_CHARS) })).max(MAX_TURNS),
});

/**
 * Answers one Tradelink Assistant message (BUY-47 to BUY-50). History lives in the browser for the
 * session only. The assistant reads; it never places an order.
 */
export async function askAction(message: string, history: AskTurn[]): Promise<AskReply> {
  const session = await requireRole("buyer");
  const parsed = askSchema.safeParse({ message, history });
  if (!parsed.success) return textReply(ASK_COPY.invalidInput);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: allowed } = await supabase.rpc("hit_rate_limit", {
      p_action: "ask",
      p_limit: ASK_LIMIT_PER_HOUR,
      p_window_seconds: 3600,
    });
    if (allowed === false) return textReply(ASK_COPY.rateLimited);
    return await respondToAsk(session, parsed.data.message, parsed.data.history);
  } catch (error) {
    unstable_rethrow(error);
    logger.error("ask_failed", { error: error instanceof Error ? error.message : "unknown" });
    return textReply(ASK_COPY.unavailable);
  }
}

const cartLinesSchema = z
  .array(
    z.object({
      productId: z.uuid().nullable(),
      qty: z.number().int().min(1).max(9999),
      sourceText: z.string().max(240),
      options: z.array(z.uuid()).max(5),
      state: z.enum(DRAFT_STATES),
      kg: z.number().positive().nullable(),
      qtyAssumed: z.boolean(),
    }),
  )
  .min(1)
  .max(60);

/**
 * "Add to cart" under an assistant reply: adds the lines to the buyer's draft with their state and
 * options, checked against the buyer's own catalogue. Nothing is placed from chat; the buyer places
 * orders from the cart (BUY-49.2).
 */
export async function addToCartAction(lines: CartLine[]): Promise<ActionResult<{ added: number }>> {
  const session = await requireRole("buyer");
  const parsed = cartLinesSchema.safeParse(lines);
  if (!parsed.success) return { ok: false, error: ASK_COPY.invalidInput };

  const visible = new Set((await getBuyerCatalogue()).map((item) => item.id));
  const result = await addLinesToDraft(session.userId, linesForCatalogue(parsed.data, visible));
  if (!result.ok) return result;
  revalidatePath("/buyer", "layout");
  return { ok: true, data: { added: parsed.data.length } };
}

const placeCartSchema = z.object({ draftVersion: z.number().int().min(0), key: z.uuid() });

/** Database refusals put in chat words: the cart page highlights lines, the chat cannot. */
const PLACE_ERRORS: Record<string, string> = {
  STALE_DRAFT: ASK_COPY.cartChanged,
  STOCK_SHORT: ASK_COPY.stockShort,
};

/**
 * Place order under an assistant cart reply: the buyer's tap places the cart exactly as the
 * assistant showed it, one order per supplier, through the same place_orders function as the cart
 * page. Refused if the cart changed since, or if any line still needs the buyer (BUY-22).
 */
export async function placeCartAction(draftVersion: number, key: string): Promise<ActionResult<PlacedOrders>> {
  const session = await requireRole("buyer");
  const parsed = placeCartSchema.safeParse({ draftVersion, key });
  if (!parsed.success) return { ok: false, error: ASK_COPY.invalidInput };

  const [draft, catalogue] = await Promise.all([readDraft(session.userId), getBuyerCatalogue()]);
  if (draft.version !== parsed.data.draftVersion) return { ok: false, error: ASK_COPY.cartChanged, reason: "STALE_DRAFT" };
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const check = checkLines(draft.lines, byId);
  if (draft.lines.length === 0 || check.unresolved > 0 || check.over.length > 0) {
    return { ok: false, error: ASK_COPY.cartNeedsReview };
  }

  const lines = draft.lines.flatMap((line) =>
    line.productId ? [{ productId: line.productId, qty: line.qty, sourceText: line.sourceText }] : [],
  );
  const result = await placeOrdersAction({ lines, draftVersion: draft.version, key: parsed.data.key });
  if (result.ok) return result;
  return { ...result, error: (result.reason && PLACE_ERRORS[result.reason]) || result.error };
}
