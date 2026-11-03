import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrderCardData } from "@/domain/ask/types";
import { supplierRecords, type SupplierRecord } from "@/domain/ask/supplier-record";
import { lineTotal } from "@/domain/money";
import { singaporeDateOf } from "@/domain/singapore-time";
import { getConnectedSuppliers } from "@/features/buyer/queries";
import type { OrderView } from "@/features/orders/queries";

const DELIVERED_LIMIT = 500;
const HIDDEN_SUPPLIER = "Business no longer connected";

export function toOrderCard(order: OrderView): OrderCardData {
  return {
    number: order.number,
    status: order.status,
    supplierName: order.supplier.name,
    deliveryDate: order.confirmedDeliveryDate ?? order.requestedDeliveryDate,
    lines: order.lines.map((line) => ({ qty: line.qty, name: line.name })),
    totalCents: order.totalCents,
  };
}

const orderCardSchema = z.object({
  number: z.number(),
  status: z.enum(["pending", "accepted", "out_for_delivery", "delivered", "rejected", "cancelled"]),
  requested_delivery_date: z.string().nullable(),
  confirmed_delivery_date: z.string().nullable(),
  supplier: z.object({ name: z.string() }).nullable(),
  order_lines: z.array(
    z.object({
      qty: z.number(),
      unit_price: z.union([z.string(), z.number()]),
      product: z.object({ name: z.string() }),
    }),
  ),
});

/**
 * One of the buyer's own orders by its number, or null. Filtered on the buyer's organisation as
 * well as RLS, so an order number from another business never resolves (BUY-50.2).
 */
export async function getOrderCardByNumber(orgId: string, number: number): Promise<OrderCardData | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `number, status, requested_delivery_date, confirmed_delivery_date,
      supplier:organisations!orders_supplier_org_id_fkey(name),
      order_lines(qty, unit_price, product:products(name))`,
    )
    .eq("buyer_org_id", orgId)
    .eq("number", number)
    .maybeSingle();
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  if (!data) return null;
  const row = orderCardSchema.parse(data);
  return {
    number: row.number,
    status: row.status,
    supplierName: row.supplier?.name ?? HIDDEN_SUPPLIER,
    deliveryDate: row.confirmed_delivery_date ?? row.requested_delivery_date,
    lines: row.order_lines.map((line) => ({ qty: line.qty, name: line.product.name })),
    totalCents: row.order_lines.reduce((sum, line) => sum + lineTotal(Number(line.unit_price).toFixed(2), line.qty), 0),
  };
}

const deliveredSchema = z.object({
  supplier_org_id: z.uuid(),
  confirmed_delivery_date: z.string().nullable(),
  requested_delivery_date: z.string().nullable(),
  delivered_at: z.string().nullable(),
});

/** On-time record for the buyer's connected active suppliers, from its own delivered orders (BUY-40.2). */
export async function getSupplierRecords(orgId: string): Promise<SupplierRecord[]> {
  const supabase = await createSupabaseServerClient();
  const [suppliers, { data, error }] = await Promise.all([
    getConnectedSuppliers(orgId),
    supabase
      .from("orders")
      .select("supplier_org_id, confirmed_delivery_date, requested_delivery_date, delivered_at")
      .eq("buyer_org_id", orgId)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(DELIVERED_LIMIT),
  ]);
  if (error) throw new Error(`Could not load deliveries: ${error.message}`);
  const deliveries = z
    .array(deliveredSchema)
    .parse(data)
    .map((row) => ({
      supplierId: row.supplier_org_id,
      dueDate: row.confirmed_delivery_date ?? row.requested_delivery_date,
      deliveredOn: row.delivered_at ? singaporeDateOf(new Date(row.delivered_at)) : null,
    }));
  return supplierRecords(
    suppliers.filter((supplier) => supplier.status === "active"),
    deliveries,
  );
}
