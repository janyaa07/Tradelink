"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { getSession, roleOf } from "@/data/session";
import { singaporeDateOf } from "@/domain/singapore-time";
import type { ActionResult } from "@/lib/errors";
import { formatDate, orderNumber } from "@/ui/format";

/**
 * Delivery date changes, messages and calling off the rest of an order. Both the buyer and the
 * supplier on an order use these; the database functions check which side the caller is on.
 */

const INVALID: ActionResult<never> = { ok: false, error: "Check the details and try again." };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const note = z.string().trim().max(500).optional();

async function signedIn(): Promise<boolean> {
  const session = await getSession();
  return session !== null && roleOf(session.kind) !== "admin";
}

function refresh(): void {
  revalidatePath("/buyer", "layout");
  revalidatePath("/supplier", "layout");
}

const proposeSchema = z.object({
  orderId: z.uuid(),
  part: z.enum(["first", "rest"]),
  date: z.string().regex(ISO_DATE),
  note,
  key: z.uuid(),
});

/** Ask the other side to move a delivery; nothing changes until they accept. */
export async function proposeDeliveryDateAction(input: z.infer<typeof proposeSchema>): Promise<ActionResult<{ id: string }>> {
  if (!(await signedIn())) return INVALID;
  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success || parsed.data.date < singaporeDateOf(new Date())) return { ok: false, error: "Choose today or a later date." };
  const result = await callRpc<{ id: string; number: number }>("propose_delivery_date", {
    p_order: parsed.data.orderId,
    p_part: parsed.data.part,
    p_date: parsed.data.date,
    p_note: parsed.data.note ?? null,
    p_key: parsed.data.key,
  });
  if (!result.ok) return result;
  refresh();
  return {
    ok: true,
    data: { id: result.data.id },
    message: `Asked to move ${parsed.data.part === "rest" ? "the rest of " : ""}${orderNumber(result.data.number)} to ${formatDate(parsed.data.date)}.`,
  };
}

const answerSchema = z.object({ requestId: z.uuid(), accept: z.boolean(), note, key: z.uuid() });

/** Accept or decline the other side's date change. */
export async function answerDeliveryDateAction(input: z.infer<typeof answerSchema>): Promise<ActionResult<{ status: string }>> {
  if (!(await signedIn())) return INVALID;
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const result = await callRpc<{ status: string }>("answer_delivery_date", {
    p_request: parsed.data.requestId,
    p_accept: parsed.data.accept,
    p_note: parsed.data.note ?? null,
    p_key: parsed.data.key,
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, data: result.data, message: parsed.data.accept ? "New date agreed." : "Date change declined." };
}

const messageSchema = z.object({ orderId: z.uuid(), body: z.string().trim().min(1).max(500), key: z.uuid() });

/** A short message to the other side of an order. */
export async function sendOrderMessageAction(input: z.infer<typeof messageSchema>): Promise<ActionResult<{ id: string }>> {
  if (!(await signedIn())) return INVALID;
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a message of up to 500 characters." };
  const result = await callRpc<{ id: string }>("send_order_message", {
    p_order: parsed.data.orderId,
    p_body: parsed.data.body,
    p_key: parsed.data.key,
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, data: result.data, message: "Message sent." };
}

const orderSchema = z.object({ orderId: z.uuid(), key: z.uuid() });

/** Call off the rest of an order before it goes out. Either side can. */
export async function cancelRestAction(input: z.infer<typeof orderSchema>): Promise<ActionResult<{ number: number }>> {
  if (!(await signedIn())) return INVALID;
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const result = await callRpc<{ number: number }>("cancel_rest", { p_order: parsed.data.orderId, p_key: parsed.data.key });
  if (!result.ok) return result;
  refresh();
  return { ok: true, data: result.data, message: `The rest of ${orderNumber(result.data.number)} is cancelled.` };
}
