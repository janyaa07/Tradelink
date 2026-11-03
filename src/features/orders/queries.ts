import "server-only";
import { z } from "zod";
import { ART_KINDS, UNITS } from "@/domain/catalogue";
import { toCents } from "@/domain/money";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrderStatus } from "@/ui/ProgressSteps";

export const OPEN_STATUSES: OrderStatus[] = ["pending", "accepted", "out_for_delivery"];

const orgSchema = z.object({ id: z.uuid(), name: z.string() });
const rowSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  status: z.enum(["pending", "accepted", "out_for_delivery", "delivered", "rejected", "cancelled"]),
  check_status: z.enum(["unchecked", "all_here", "problem"]),
  requested_delivery_date: z.string().nullable(),
  confirmed_delivery_date: z.string().nullable(),
  created_at: z.string(),
  buyer: orgSchema,
  supplier: orgSchema,
  order_lines: z.array(
    z.object({
      id: z.uuid(),
      qty: z.number(),
      asked_qty: z.number(),
      unit_price: z.union([z.string(), z.number()]),
      held: z.boolean(),
      product: z.object({
        id: z.uuid(),
        name: z.string(),
        sku: z.string(),
        unit: z.enum(UNITS),
        art: z.enum(ART_KINDS),
        status: z.string(),
      }),
    }),
  ),
});

export type OrderLineView = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unit: (typeof UNITS)[number];
  art: (typeof ART_KINDS)[number];
  qty: number;
  askedQty: number;
  unitPrice: string;
  held: boolean;
  productUnconfirmed: boolean;
};

export type OrderView = {
  id: string;
  number: number;
  status: OrderStatus;
  checkStatus: "unchecked" | "all_here" | "problem";
  requestedDeliveryDate: string | null;
  confirmedDeliveryDate: string | null;
  createdAt: string;
  buyer: { id: string; name: string };
  supplier: { id: string; name: string };
  lines: OrderLineView[];
  totalCents: number;
};

const SELECT = `id, number, status, check_status, requested_delivery_date, confirmed_delivery_date, created_at,
  buyer:organisations!orders_buyer_org_id_fkey(id, name),
  supplier:organisations!orders_supplier_org_id_fkey(id, name),
  order_lines(id, qty, asked_qty, unit_price, held, product:products(id, name, sku, unit, art, status))`;

function toView(row: z.infer<typeof rowSchema>): OrderView {
  const lines = row.order_lines.map((line) => ({
    id: line.id,
    productId: line.product.id,
    name: line.product.name,
    sku: line.product.sku,
    unit: line.product.unit,
    art: line.product.art,
    qty: line.qty,
    askedQty: line.asked_qty,
    unitPrice: Number(line.unit_price).toFixed(2),
    held: line.held,
    productUnconfirmed: line.product.status === "unconfirmed",
  }));
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    checkStatus: row.check_status,
    requestedDeliveryDate: row.requested_delivery_date,
    confirmedDeliveryDate: row.confirmed_delivery_date,
    createdAt: row.created_at,
    buyer: row.buyer,
    supplier: row.supplier,
    lines,
    totalCents: lines.reduce((total, line) => total + toCents(line.unitPrice) * line.qty, 0),
  };
}

export type OrderFilter = {
  buyerOrgId?: string;
  supplierOrgId?: string;
  statuses?: OrderStatus[];
  limit?: number;
};

/** Orders visible to the signed-in user (RLS), newest first. */
export async function getOrders(filter: OrderFilter = {}): Promise<OrderView[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("orders").select(SELECT).order("created_at", { ascending: false }).limit(filter.limit ?? 50);
  if (filter.buyerOrgId) query = query.eq("buyer_org_id", filter.buyerOrgId);
  if (filter.supplierOrgId) query = query.eq("supplier_org_id", filter.supplierOrgId);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return z.array(rowSchema).parse(data).map(toView);
}
