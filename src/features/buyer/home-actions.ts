"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { requireRole } from "@/data/session";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { formatDaysLeft } from "@/domain/reorder";
import { rankProducts } from "@/domain/reader/rules";
import { addLinesToDraft } from "@/features/ordering/draft-store";
import type { ActionResult } from "@/lib/errors";
import { orderNumber } from "@/ui/format";
import { getBuyerCatalogue, getUsualItems } from "./queries";
import { getReorderPlan } from "./reorder-plan";

const NOT_AVAILABLE: ActionResult<never> = { ok: false, error: "This record is not available." };

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}

/** "OK, noted" on a price change: hidden for everyone in the business (BUY-02). */
export async function ackPriceChangeAction(id: string): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  if (!z.uuid().safeParse(id).success) return NOT_AVAILABLE;
  return done(await callRpc("ack_price_change", { p_change: id }));
}

/** "OK" on a reply to a problem (BUY-04). */
export async function markIssueSeenAction(id: string): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  if (!z.uuid().safeParse(id).success) return NOT_AVAILABLE;
  return done(await callRpc("mark_issue_seen", { p_issue: id }));
}

const creditInput = z.object({ issueId: z.uuid(), key: z.uuid() });

/** "Mark received" on a promised credit: the problem moves to credit received. */
export async function markCreditReceivedAction(input: z.infer<typeof creditInput>): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  const parsed = creditInput.safeParse(input);
  if (!parsed.success) return NOT_AVAILABLE;
  return done(await callRpc("mark_credit_received", { p_issue: parsed.data.issueId, p_key: parsed.data.key }));
}

/** "Skip" on a part delivery (BUY-03). */
export async function skipPartialAction(id: string): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  if (!z.uuid().safeParse(id).success) return NOT_AVAILABLE;
  return done(await callRpc("resolve_partial", { p_partial: id, p_choice: "skipped" }));
}

const partialRowSchema = z.object({
  product_id: z.uuid(),
  asked: z.number(),
  sent: z.number(),
  product: z.object({ name: z.string(), supplier_org_id: z.uuid() }).nullable(),
  parent: z.object({ number: z.number() }).nullable(),
});

/**
 * "Order the rest": adds the remainder to the cart. Products from other connected suppliers
 * that share a name word and have the stock are offered as best matches (BUY-03).
 */
export async function orderRemainderAction(id: string): Promise<ActionResult<unknown>> {
  const session = await requireRole("buyer");
  if (!z.uuid().safeParse(id).success) return NOT_AVAILABLE;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("partial_fulfilments")
    .select("product_id, asked, sent, product:products(name, supplier_org_id), parent:orders(number)")
    .eq("id", id)
    .eq("status", "new")
    .maybeSingle();
  const parsed = partialRowSchema.safeParse(data);
  if (error || !parsed.success) return NOT_AVAILABLE;
  const partial = parsed.data;
  const remainder = Math.max(1, partial.asked - partial.sent);

  const catalogue = await getBuyerCatalogue();
  const substitutes = partial.product
    ? rankProducts(partial.product.name.toLowerCase(), catalogue)
        .map((candidate) => candidate.item)
        .filter((item) => item.supplierOrgId !== partial.product?.supplier_org_id && item.status === "active")
        .filter((item) => item.available >= remainder)
    : [];
  const added = await addLinesToDraft(session.userId, [
    {
      productId: partial.product_id,
      qty: remainder,
      sourceText: `Remainder of ${partial.parent ? orderNumber(partial.parent.number) : "your order"}`,
      state: "suggested",
      options: [partial.product_id, ...substitutes.map((item) => item.id)],
    },
  ]);
  if (!added.ok) return added;
  return done(await callRpc("resolve_partial", { p_partial: id, p_choice: "added" }));
}

/** "Add to cart" on Ready for tomorrow: the plan is worked out again on the server (BUY-08). */
export async function loadReorderPlanAction(): Promise<ActionResult<unknown>> {
  const session = await requireRole("buyer");
  const plan = await getReorderPlan(session.orgId);
  if (plan.rows.length === 0) return { ok: false, error: "You have enough stock for the next few days." };
  return done(
    await addLinesToDraft(
      session.userId,
      plan.rows.map((row) => ({
        productId: row.productId,
        qty: row.qty,
        sourceText: `Suggested, ${formatDaysLeft(row.daysLeft)} days left`,
        state: "suggested",
      })),
    ),
  );
}

/** "Not today": hides the current plan items until tomorrow (BUY-08). */
export async function skipReorderPlanAction(): Promise<ActionResult<unknown>> {
  const session = await requireRole("buyer");
  const plan = await getReorderPlan(session.orgId);
  if (plan.rows.length === 0) return { ok: true, data: null };
  return done(await callRpc("skip_restock_today", { p_products: plan.rows.map((row) => row.productId) }));
}

/** "My usual": every usual item at its usual quantity, marked "My usual" (BUY-12). */
export async function loadUsualAction(): Promise<ActionResult<unknown>> {
  const session = await requireRole("buyer");
  const [usuals, catalogue] = await Promise.all([getUsualItems(session.orgId), getBuyerCatalogue()]);
  const visible = new Set(catalogue.map((item) => item.id));
  const lines = usuals
    .filter((usual) => visible.has(usual.productId))
    .map((usual) => ({ productId: usual.productId, qty: usual.usualQty, sourceText: "My usual", state: "suggested" as const }));
  if (lines.length === 0) return { ok: false, error: "You have no usual items yet. Add them in Settings." };
  return done(await addLinesToDraft(session.userId, lines));
}

const placePlanInput = z.uuid();

/**
 * "Place orders" on Next up: the plan is worked out again on the server and placed straight away,
 * one order per supplier, leaving the cart as it is (BUY-08).
 */
export async function placeReorderPlanAction(key: string): Promise<ActionResult<string>> {
  const session = await requireRole("buyer");
  if (!placePlanInput.safeParse(key).success) return NOT_AVAILABLE;
  const plan = await getReorderPlan(session.orgId);
  if (plan.rows.length === 0) return { ok: false, error: "You have enough stock for the next few days." };
  const result = await callRpc<{ orders: { number: number; supplierName: string }[] }>("place_orders", {
    p_lines: plan.rows.map((row) => ({ productId: row.productId, qty: row.qty, sourceText: `Suggested, ${formatDaysLeft(row.daysLeft)} days left` })),
    p_draft_version: null,
    p_key: key,
  });
  if (!result.ok) {
    return result.reason === "STOCK_SHORT" ? { ok: false, error: "Some of that just sold out. Review it in the cart instead." } : result;
  }
  revalidatePath("/buyer", "layout");
  return { ok: true, data: `Placed ${result.data.orders.map((order) => `${orderNumber(order.number)} to ${order.supplierName}`).join(" and ")}.` };
}
