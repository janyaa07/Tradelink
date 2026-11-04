"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CardError, MISSING_SECRET_KEY } from "@/cards/errors";
import { callRpc } from "@/data/rpc";
import { createSupabaseAdminClient, hasAdminClient } from "@/data/supabase/admin";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { renderCard } from "./render";
import { devPagesEnabled, getMyShop, type MyShop } from "./shop";

/** Kopi Corner's items in supabase/tradelink-ai-mock-data.sql. */
const DEMO_ITEMS = {
  eggs: "00000000-0000-4000-e000-000000000001",
  oil: "00000000-0000-4000-e000-000000000009",
  wings: "00000000-0000-4000-e000-000000000010",
} as const;

const UNDO_MINUTES = 10;

type DemoResult = ActionResult<{ cardId: string }>;

const OrderResult = z.object({ order_id: z.string(), version: z.number().int() });
const LineRow = z.object({ id: z.string() });

async function asOwner(): Promise<{ shop: MyShop; threadId: string } | { error: string }> {
  if (!devPagesEnabled()) return { error: "Dev pages are off." };
  const shop = await getMyShop();
  if (!shop || shop.role !== "owner") return { error: "Sign in as a shop owner to make demo cards." };
  const thread = await callRpc<string>("rs_shop_thread", { p_shop: shop.shopId });
  if (!thread.ok) return { error: thread.error };
  const threadId = z.string().safeParse(thread.data);
  return threadId.success ? { shop, threadId: threadId.data } : { error: "The shop chat could not be opened." };
}

async function finish(make: () => Promise<string>): Promise<DemoResult> {
  try {
    const cardId = await make();
    revalidatePath("/r", "layout");
    return { ok: true, data: { cardId } };
  } catch (error) {
    if (error instanceof CardError) {
      logger.warn("demo_card_failed", { reason: error.reason });
      return { ok: false, error: error.message, reason: error.reason };
    }
    throw error;
  }
}

/**
 * As the signed-in owner: a draft order with two pinned lines and one line he picks, submitted, then
 * an order summary card in the shop chat (docs/AI_DESIGN.md, M0 round-trip).
 */
export async function createDemoOrderCardAction(): Promise<DemoResult> {
  const owner = await asOwner();
  if ("error" in owner) return { ok: false, error: owner.error };
  const { shop, threadId } = owner;

  const created = await callRpc("rs_order_create", {
    p_shop: shop.shopId,
    p_source: "manual",
    p_lines: [
      { raw_text: "2 trays eggs", shop_item_id: DEMO_ITEMS.eggs, pin_reason: "exact", qty: 2 },
      { raw_text: "3 tins oil", shop_item_id: DEMO_ITEMS.oil, pin_reason: "nickname", qty: 3 },
      { raw_text: "chicken wings 5kg" },
    ],
    p_key: crypto.randomUUID(),
  });
  if (!created.ok) return created;
  const order = OrderResult.parse(created.data);

  const supabase = await createSupabaseServerClient();
  const { data: open } = await supabase
    .from("shop_order_line")
    .select("id")
    .eq("order_id", order.order_id)
    .is("shop_item_id", null)
    .limit(1)
    .maybeSingle();
  const line = LineRow.safeParse(open);
  if (!line.success) return { ok: false, error: "The demo order has no line to pick." };

  const picked = await callRpc("rs_order_pick", {
    p_order: order.order_id,
    p_version: order.version,
    p_line: line.data.id,
    p_shop_item: DEMO_ITEMS.wings,
    p_qty: 5,
    p_key: crypto.randomUUID(),
  });
  if (!picked.ok) return picked;
  const afterPick = OrderResult.parse(picked.data);

  const submitted = await callRpc("rs_order_submit", { p_order: order.order_id, p_version: afterPick.version, p_key: crypto.randomUUID() });
  if (!submitted.ok) return submitted;

  return finish(async () => {
    const card = await renderCard({
      type: "order_summary",
      subject: { kind: "shop_order", id: order.order_id },
      shopId: shop.shopId,
      threadId,
      createdBy: "system",
    });
    return card.id;
  });
}

/** A logged agent action with a 10-minute undo window, shown as a notice with Undo. */
export async function createDemoNoticeCardAction(): Promise<DemoResult> {
  const owner = await asOwner();
  if ("error" in owner) return { ok: false, error: owner.error };
  const { shop, threadId } = owner;
  if (!hasAdminClient()) return { ok: false, error: MISSING_SECRET_KEY, reason: "SETUP" };

  const { data, error } = await createSupabaseAdminClient().rpc("rs_log_agent_action", {
    p_action: {
      shop_id: shop.shopId,
      agent: "AG2",
      action: "line.switch",
      inputs: { summary: "Switched 2 trays of eggs from Ah Huat Trading to KL Trading, because Ah Huat is out of stock today." },
      rule: "demo",
      outcome: "done",
      undo_until: new Date(Date.now() + UNDO_MINUTES * 60_000).toISOString(),
    },
  });
  const actionId = z.string().safeParse(data);
  if (error || !actionId.success) return { ok: false, error: "The demo action could not be logged." };

  return finish(async () => {
    const card = await renderCard({
      type: "agent_action_notice",
      subject: { kind: "agent_action", id: actionId.data },
      shopId: shop.shopId,
      threadId,
      reason: { text: "Ah Huat Trading marked eggs out of stock for tomorrow." },
      createdBy: "system",
    });
    return card.id;
  });
}

/** One short question about the shop, answered with a tap. */
export async function createDemoQuestionCardAction(): Promise<DemoResult> {
  const owner = await asOwner();
  if ("error" in owner) return { ok: false, error: owner.error };
  const { shop, threadId } = owner;

  return finish(async () => {
    const card = await renderCard({
      type: "question",
      subject: { kind: "shop", id: shop.shopId },
      shopId: shop.shopId,
      threadId,
      question: {
        text: "Should Tradelink AI order bean sprouts on Saturdays too?",
        options: [
          { id: "yes", label: "Yes, add Saturday" },
          { id: "no", label: "No, keep weekdays" },
        ],
      },
      createdBy: "system",
    });
    return card.id;
  });
}
