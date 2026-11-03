"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/data/session";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ASK_COPY, textReply } from "@/domain/ask/replies";
import type { AskReply, AskTurn, ReviewLine } from "@/domain/ask/types";
import { getBuyerCatalogue } from "@/features/buyer/queries";
import { addLinesToDraft } from "@/features/ordering/draft-store";
import type { ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { respondToAsk } from "./respond";

const MAX_CHARS = 2000;
const MAX_TURNS = 20;
const ASK_LIMIT_PER_HOUR = 60;

const askSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHARS),
  history: z.array(z.object({ role: z.enum(["buyer", "tradelink"]), text: z.string().max(MAX_CHARS) })).max(MAX_TURNS),
});

/**
 * Answers one Ask message (BUY-47 to BUY-50). History lives in the browser for the session only.
 * Ask reads; it never places an order.
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

const reviewSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      qty: z.number().int().min(1).max(9999),
      sourceText: z.string().max(240),
      options: z.array(z.uuid()).max(5),
      state: z.enum(["manual", "suggested"]),
    }),
  )
  .min(1)
  .max(60);

/**
 * "Review order": adds the lines Ask read to the buyer's draft and leaves sending to the review
 * screen (BUY-49.2). Products outside the buyer's catalogue are dropped.
 */
export async function reviewAskOrderAction(lines: ReviewLine[]): Promise<ActionResult<{ version: number }>> {
  const session = await requireRole("buyer");
  const parsed = reviewSchema.safeParse(lines);
  if (!parsed.success) return { ok: false, error: ASK_COPY.invalidInput };

  const visible = new Set((await getBuyerCatalogue()).map((item) => item.id));
  const usable = parsed.data
    .filter((line) => visible.has(line.productId))
    .map((line) => ({ ...line, options: line.options.filter((id) => visible.has(id)) }));
  if (usable.length === 0) return { ok: false, error: "No items found. Add a quantity and a product name." };

  const result = await addLinesToDraft(session.userId, usable);
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}
