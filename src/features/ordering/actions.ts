"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCatalogue } from "@/data/catalogue";
import { callRpc } from "@/data/rpc";
import { requireRole } from "@/data/session";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { UNITS } from "@/domain/catalogue";
import { claudeModel } from "@/integrations/claude/client";
import { readOrderWithClaude } from "@/integrations/claude/read-order";
import type { ActionResult } from "@/lib/errors";
import { draftLineSchema, type DraftLine } from "./draft";

const READ_LIMIT_PER_HOUR = 30;

export type ReadOrderData = { lines: DraftLine[]; readBy: "ai" | "rules"; requestedDeliveryDate: string | null };

/** Reads a typed order into cart lines for the assistant. Nothing is sent to a supplier (BUY-10, BUY-11). */
export async function readOrderAction(text: string): Promise<ActionResult<ReadOrderData>> {
  await requireRole("buyer");
  const parsed = z.string().trim().min(1).max(4000).safeParse(text);
  if (!parsed.success) return { ok: false, error: "No items found. Add a quantity and a product name." };

  const supabase = await createSupabaseServerClient();
  const { data: allowed } = await supabase.rpc("hit_rate_limit", {
    p_action: "order_read",
    p_limit: READ_LIMIT_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (allowed === false) return { ok: false, error: "Too many requests. Try again in a few minutes." };

  const catalogue = await getCatalogue();
  const { result, usage } = await readOrderWithClaude(parsed.data, catalogue);
  await supabase.rpc("record_ai_usage", {
    p_feature: "order_read",
    p_model: claudeModel(),
    p_input: usage.inputTokens,
    p_output: usage.outputTokens,
    p_latency: usage.latencyMs,
    p_outcome: usage.outcome,
    p_lines_read: result.lines.length,
    p_lines_matched: result.lines.filter((line) => line.state === "matched").length,
  });

  if (result.lines.length === 0) return { ok: false, error: "No items found. Add a quantity and a product name." };
  const lines = result.lines.map((line) => ({ ...line, id: crypto.randomUUID() }));
  return { ok: true, data: { lines, readBy: result.readBy, requestedDeliveryDate: result.requestedDeliveryDate } };
}

export async function saveDraftAction(lines: DraftLine[], version: number): Promise<ActionResult<{ version: number }>> {
  await requireRole("buyer");
  const parsed = z.object({ lines: z.array(draftLineSchema).max(60), version: z.number().int().min(0) }).safeParse({ lines, version });
  if (!parsed.success) return { ok: false, error: "Check the highlighted lines before placing this order." };
  const result = await callRpc<{ version: number }>("save_draft", { p_lines: parsed.data.lines, p_version: parsed.data.version });
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}

const placeSchema = z.object({
  lines: z
    .array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(9999), sourceText: z.string().max(240) }))
    .min(1)
    .max(60),
  draftVersion: z.number().int().min(0),
  key: z.uuid(),
});

export type PlacedOrders = { orders: { id: string; number: number; supplierName: string }[] };

/** Place order from the cart: one order per supplier, stock reserved in one transaction (BUY-22). */
export async function placeOrdersAction(input: z.infer<typeof placeSchema>): Promise<ActionResult<PlacedOrders>> {
  await requireRole("buyer");
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted lines before placing this order." };
  const result = await callRpc<PlacedOrders>("place_orders", {
    p_lines: parsed.data.lines,
    p_draft_version: parsed.data.draftVersion,
    p_key: parsed.data.key,
  });
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}

const addProductSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(80, "Enter a product name."),
  unit: z.enum(UNITS),
  price: z.number({ error: "Enter a price above 0." }).gt(0, "Enter a price above 0.").max(99999, "Enter a price above 0."),
  supplierOrgId: z.uuid({ error: "Choose a supplier or add a new one." }),
  key: z.uuid(),
});

/** Adds a missing product to a connected supplier's catalogue as unconfirmed (BUY-18). */
export async function buyerAddProductAction(input: z.infer<typeof addProductSchema>): Promise<ActionResult<{ productId: string }>> {
  await requireRole("buyer");
  const parsed = addProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  const result = await callRpc<{ productId: string }>("buyer_add_product", {
    p_name: parsed.data.name,
    p_unit: parsed.data.unit,
    p_price: parsed.data.price,
    p_supplier: parsed.data.supplierOrgId,
    p_key: parsed.data.key,
  });
  if (!result.ok && result.reason === "DUPLICATE") {
    return { ok: false, error: "This product is already in the catalogue. Choose it from the list." };
  }
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}
