import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrderStatRow } from "../orderStats";
import { money, selectAll, selectMaybe } from "./fetch";

const rowSchema = z.object({
  status: z.enum(["pending", "accepted", "out_for_delivery", "delivered", "rejected", "cancelled"]),
  buyer_org_id: z.uuid(),
  supplier_org_id: z.uuid(),
  order_lines: z.array(z.object({ qty: z.number(), unit_price: money })),
});

type Scope = { buyerOrgId?: string; supplierOrgId?: string };

const scopeSchema = z.object({
  buyer_org_id: z.uuid(),
  supplier_org_id: z.uuid(),
  status: rowSchema.shape.status,
});

/**
 * The buyer, supplier and status of one order number, or null. Used to narrow the shared
 * getOrders query to that order's trading pair, which has no order number filter.
 */
export async function findOrderScope(
  number: number,
): Promise<{ buyerOrgId: string; supplierOrgId: string; status: OrderStatRow["status"] } | null> {
  const supabase = await createSupabaseServerClient();
  const row = await selectMaybe(
    scopeSchema,
    "the order",
    supabase.from("orders").select("buyer_org_id, supplier_org_id, status").eq("number", number).maybeSingle(),
  );
  return row ? { buyerOrgId: row.buyer_org_id, supplierOrgId: row.supplier_org_id, status: row.status } : null;
}

/** Every order in scope with just enough to total it, for counts and order value. */
export async function getOrderStatRows(scope: Scope = {}): Promise<OrderStatRow[]> {
  const supabase = await createSupabaseServerClient();
  const rows = await selectAll(rowSchema, "order totals", (from, to) => {
    let query = supabase
      .from("orders")
      .select("status, buyer_org_id, supplier_org_id, order_lines(qty, unit_price)")
      .order("id")
      .range(from, to);
    if (scope.buyerOrgId) query = query.eq("buyer_org_id", scope.buyerOrgId);
    if (scope.supplierOrgId) query = query.eq("supplier_org_id", scope.supplierOrgId);
    return query;
  });
  return rows.map((row) => ({
    status: row.status,
    buyerOrgId: row.buyer_org_id,
    supplierOrgId: row.supplier_org_id,
    lines: row.order_lines.map((line) => ({ qty: line.qty, unitPrice: line.unit_price })),
  }));
}
