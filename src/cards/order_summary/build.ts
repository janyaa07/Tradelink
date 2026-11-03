import { z } from "zod";
import { notFound, parseRows } from "../db";
import type { CardState } from "../envelope";
import type { BuildContext, Hydrated } from "../types";
import { ORDER_STATES, type OrderState, type OrderSummaryData } from "./schema";
import { itemName, summarizeOrder, type SummaryLineInput } from "./summary";

const ORDER_CARD_STATE: Record<OrderState, CardState> = {
  DRAFT: "draft",
  AWAITING_CONFIRM: "awaiting_confirm",
  CONFIRMED: "confirmed",
  // card_instance has no "cancelled" state; the card shows "Cancelled" from data.orderState.
  CANCELLED: "done",
};

const OrderRowSchema = z
  .object({ id: z.string(), shop_id: z.string(), state: z.enum(ORDER_STATES), version: z.number().int(), created_at: z.string() })
  .nullable();

const LineRowSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  raw_text: z.string(),
  qty: z.number().int().nullable(),
  status: z.string(),
  expected_price_cents: z.number().int().nullable(),
  delivery_date: z.string().nullable(),
  shop_item: z
    .object({
      order_unit: z.string(),
      billing_type: z.enum(["fixed", "per_kg", "market"]),
      supplier_id: z.string().nullable(),
      product: z.object({ brand: z.string().nullable(), name: z.string(), variant: z.string().nullable(), pack_size: z.string().nullable() }),
    })
    .nullable(),
});

const SupplierRowSchema = z.object({
  supplier_id: z.string(),
  minimum_order_cents: z.number().int().nullable(),
  payment_terms: z.string().nullable(),
  supplier: z.object({ name: z.string() }).nullable(),
});

const PoRowSchema = z.object({ supplier_id: z.string(), number: z.number().int() });

export const ORDER_LINE_SELECT =
  "id, position, raw_text, qty, status, expected_price_cents, delivery_date, shop_item:shop_item_id (order_unit, billing_type, supplier_id, product:product_id (brand, name, variant, pack_size))";

/** Loads the order, its lines, the shop's supplier terms and any purchase orders, all scoped to the shop. */
export async function buildOrderSummary({ db, subject, shopId }: BuildContext): Promise<Hydrated<OrderSummaryData>> {
  const order = parseRows(
    await db.from("shop_order").select("id, shop_id, state, version, created_at").eq("id", subject.id).eq("shop_id", shopId).maybeSingle(),
    OrderRowSchema,
    "order",
  );
  if (!order) throw notFound("order");

  const [lines, suppliers, purchaseOrders] = await Promise.all([
    db.from("shop_order_line").select(ORDER_LINE_SELECT).eq("order_id", order.id).order("position"),
    db.from("shop_supplier").select("supplier_id, minimum_order_cents, payment_terms, supplier:supplier_id (name)").eq("shop_id", shopId),
    db.from("purchase_order").select("supplier_id, number").eq("order_id", order.id).eq("shop_id", shopId),
  ]);

  const lineInputs: SummaryLineInput[] = parseRows(lines, z.array(LineRowSchema), "order lines").map((line) => ({
    lineId: line.id,
    position: line.position,
    rawText: line.raw_text,
    qty: line.qty,
    status: line.status,
    priceCents: line.expected_price_cents,
    deliveryDate: line.delivery_date,
    item: line.shop_item
      ? {
          name: itemName(line.shop_item.product),
          orderUnit: line.shop_item.order_unit,
          billingType: line.shop_item.billing_type,
          supplierId: line.shop_item.supplier_id,
        }
      : null,
  }));

  const data = summarizeOrder({
    orderId: order.id,
    orderState: order.state,
    createdAt: order.created_at,
    lines: lineInputs,
    suppliers: parseRows(suppliers, z.array(SupplierRowSchema), "suppliers").map((row) => ({
      supplierId: row.supplier_id,
      name: row.supplier?.name ?? "Supplier",
      minimumOrderCents: row.minimum_order_cents,
      paymentTerms: row.payment_terms,
    })),
    purchaseOrders: parseRows(purchaseOrders, z.array(PoRowSchema), "purchase orders").map((po) => ({
      supplierId: po.supplier_id,
      number: po.number,
    })),
  });

  return {
    data,
    state: ORDER_CARD_STATE[order.state],
    subjectVersion: order.version,
    audience: "shop",
    supplierId: null,
    expiresAt: null,
  };
}
