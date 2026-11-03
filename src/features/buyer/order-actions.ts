"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { requireRole } from "@/data/session";
import type { ActionResult } from "@/lib/errors";
import { PROBLEM_TYPES } from "./problem";

const orderInput = z.object({ orderId: z.uuid(), key: z.uuid() });
type OrderInput = z.infer<typeof orderInput>;

const INVALID: ActionResult<never> = { ok: false, error: "Check the details and try again." };

async function orderRpc<T>(name: string, input: OrderInput): Promise<ActionResult<T>> {
  await requireRole("buyer");
  const parsed = orderInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const result = await callRpc<T>(name, { p_order: parsed.data.orderId, p_key: parsed.data.key });
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}

type OrderResult = { id: string; number: number };

/** Pending to cancelled; held stock is released and the supplier told (BUY-28). */
export async function cancelOrderAction(input: OrderInput): Promise<ActionResult<OrderResult>> {
  return orderRpc<OrderResult>("cancel_order", input);
}

/** All here: delivers if needed, marks it checked and adds to shop counts (BUY-29). */
export async function confirmAllHereAction(input: OrderInput): Promise<ActionResult<OrderResult>> {
  return orderRpc<OrderResult>("confirm_all_here", input);
}

/** Not here yet: opens a late issue, once per order while open (BUY-31). */
export async function reportNotHereAction(input: OrderInput): Promise<ActionResult<{ issueId: string }>> {
  return orderRpc<{ issueId: string }>("report_not_here", input);
}

const problemInput = z.object({
  orderId: z.uuid(),
  productId: z.uuid(),
  type: z.enum(PROBLEM_TYPES),
  qty: z.number().int().min(1).max(9999),
  note: z.string().trim().max(500),
  key: z.uuid(),
});

/** Report a problem: the order becomes delivered with an issue for quantity × line price (BUY-30). */
export async function reportProblemAction(input: z.infer<typeof problemInput>): Promise<ActionResult<{ issueId: string }>> {
  await requireRole("buyer");
  const parsed = problemInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const result = await callRpc<{ issueId: string }>("report_problem", {
    p_order: parsed.data.orderId,
    p_product: parsed.data.productId,
    p_type: parsed.data.type,
    p_qty: parsed.data.qty,
    p_note: parsed.data.note,
    p_key: parsed.data.key,
  });
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}

const creditInput = z.object({ issueId: z.uuid(), key: z.uuid() });

/** Mark credit received: a promised credit becomes received (BUY-04). */
export async function markCreditReceivedAction(input: z.infer<typeof creditInput>): Promise<ActionResult<{ id: string }>> {
  await requireRole("buyer");
  const parsed = creditInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const result = await callRpc<{ id: string }>("mark_credit_received", { p_issue: parsed.data.issueId, p_key: parsed.data.key });
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}
