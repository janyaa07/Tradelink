"use server";

import { z } from "zod";
import { requireRole } from "@/data/session";
import { orderNumber } from "@/ui/format";
import { isAllowedDeliveryDate } from "./dates";
import { checkPartQuantities } from "./product";
import { runRpc, type FormResult } from "./respond";
import { acceptSchema, answerSchema, COPY, formValues, orderSchema, parseInput } from "./validation";

type OrderResult = { number: number; status: string; reducedLines?: number };

/** Accept order with a confirmed delivery date (SUP-04). */
export async function acceptOrderAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(acceptSchema, formValues(form, ["orderId", "key", "date"]));
  if (!input.ok) return input;
  if (!isAllowedDeliveryDate(input.data.date, new Date())) return { ok: false, error: COPY.date };
  return runRpc<OrderResult>(
    "accept_order",
    { p_order: input.data.orderId, p_date: input.data.date, p_key: input.data.key },
    (data) => `${orderNumber(data.number)}: accepted.`,
  );
}

const partLinesSchema = z
  .array(z.object({ productId: z.uuid(), name: z.string().min(1).max(80), qty: z.number().int().min(1).max(9999) }))
  .min(1)
  .max(60);

/** Part accept: "How much can you send?" (SUP-05). All zeros rejects the order. */
export async function partAcceptOrderAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const order = parseInput(acceptSchema, formValues(form, ["orderId", "key", "date"]));
  if (!order.ok) return order;
  if (!isAllowedDeliveryDate(order.data.date, new Date())) return { ok: false, error: COPY.date };

  const ids = form.getAll("line").filter((value): value is string => typeof value === "string");
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const lines = parseInput(
    partLinesSchema,
    ids.map((id) => ({ productId: id, name: text(`name:${id}`), qty: Number(text(`max:${id}`)) })),
  );
  if (!lines.ok) return { ok: false, error: COPY.invalid };
  const checked = checkPartQuantities(
    lines.data,
    Object.fromEntries(ids.map((id) => [id, text(`send:${id}`)])),
  );
  if (!checked.ok) return { ok: false, error: checked.error };

  return runRpc<OrderResult>(
    "part_accept_order",
    { p_order: order.data.orderId, p_lines: checked.lines, p_date: order.data.date, p_key: order.data.key },
    (data) => {
      const ref = orderNumber(data.number);
      if (data.status === "rejected") return `${ref}: rejected.`;
      return data.reducedLines ? `${ref} part accepted. The buyer has been told.` : `${ref}: accepted.`;
    },
  );
}

async function transition(form: FormData, rpc: string, done: string): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(orderSchema, formValues(form, ["orderId", "key"]));
  if (!input.ok) return input;
  return runRpc<OrderResult>(rpc, { p_order: input.data.orderId, p_key: input.data.key }, (data) => `${orderNumber(data.number)}: ${done}.`);
}

/** Reject releases reserved stock and tells the buyer (SUP-06). */
export async function rejectOrderAction(form: FormData): Promise<FormResult> {
  return transition(form, "reject_order", "rejected");
}

/** Accepted to out for delivery (SUP-07). */
export async function markOutForDeliveryAction(form: FormData): Promise<FormResult> {
  return transition(form, "mark_out_for_delivery", "out for delivery");
}

/** Out for delivery to delivered; stock leaves on hand and reserved (SUP-07). */
export async function markDeliveredAction(form: FormData): Promise<FormResult> {
  return transition(form, "mark_delivered", "delivered");
}

/** Answers an open problem: credit, replace, on the way or dispute (SUP-09). */
export async function answerIssueAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(answerSchema, formValues(form, ["issueId", "key", "answer", "buyerName"]));
  if (!input.ok) return input;
  return runRpc(
    "answer_issue",
    { p_issue: input.data.issueId, p_answer: input.data.answer, p_key: input.data.key },
    () => `${input.data.buyerName} has been told.`,
  );
}
