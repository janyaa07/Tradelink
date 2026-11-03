import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { formatMoney } from "@/domain/money";
import { singaporeDateOf } from "@/domain/singapore-time";
import { getOrderById, type OrderView } from "@/features/orders/queries";
import { orderNumber } from "@/ui/format";

/** "ORD-1044", "1044" or 1044, as the model or person wrote it. */
export const orderNumberInput = z
  .union([z.number().int().positive(), z.string().regex(/^\s*(?:ord[-\s#]*)?\d{1,12}\s*$/i)])
  .transform((value) => (typeof value === "number" ? value : Number(value.replace(/\D/g, ""))))
  .describe('Order number, such as "ORD-1044" or 1044');

/** The person's own order with that number (RLS hides everyone else's), with its lines. */
export async function findOrder(number: number): Promise<OrderView | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("orders").select("id").eq("number", number).maybeSingle();
  const id = data && typeof data.id === "string" ? data.id : null;
  return id ? getOrderById(id) : null;
}

/** An order as the model sees it: no internal ids except the product ids it may need for a problem report. */
export function orderFacts(order: OrderView) {
  return {
    order: orderNumber(order.number),
    status: order.status.replace(/_/g, " "),
    check: order.checkStatus.replace(/_/g, " "),
    supplier: order.supplier.name,
    buyer: order.buyer.name,
    delivery: order.confirmedDeliveryDate ?? order.requestedDeliveryDate,
    placed: order.createdAt.slice(0, 10),
    total: formatMoney(order.totalCents),
    lines: order.lines.map((line) => ({ product_id: line.productId, item: line.name, qty: line.qty, unit: line.unit })),
  };
}

export const NOT_FOUND = { error: "No order with that number. Ask the person to check it." };

/** 'today', 'tomorrow' or a date, as a Singapore calendar date; undefined for no day filter. */
export function deliveryDay(value: string | undefined, now: Date): string | undefined {
  if (!value) return undefined;
  if (value === "today") return singaporeDateOf(now);
  if (value === "tomorrow") return singaporeDateOf(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return value;
}
