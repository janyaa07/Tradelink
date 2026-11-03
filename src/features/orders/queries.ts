import "server-only";
import { cache } from "react";
import { z } from "zod";
import { ART_KINDS, UNITS } from "@/domain/catalogue";
import { toCents } from "@/domain/money";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrderStatus } from "@/ui/ProgressSteps";

export const OPEN_STATUSES: OrderStatus[] = ["pending", "accepted", "out_for_delivery"];

const orgSchema = z.object({ id: z.uuid(), name: z.string() }).nullable();
const HIDDEN_ORG = { id: "", name: "Business no longer connected" };
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
    buyer: row.buyer ?? HIDDEN_ORG,
    supplier: row.supplier ?? HIDDEN_ORG,
    lines,
    totalCents: lines.reduce((total, line) => total + toCents(line.unitPrice) * line.qty, 0),
  };
}

export type CheckStatus = OrderView["checkStatus"];

/** An order number, or part of a supplier name (letters, digits, spaces and & ' . - only). */
export type OrderSearch = { kind: "number"; number: number } | { kind: "supplier"; text: string };

export type OrderFilter = {
  buyerOrgId?: string;
  supplierOrgId?: string;
  statuses?: OrderStatus[];
  checkStatuses?: CheckStatus[];
  /** Out for delivery, or delivered and not yet checked (BUY-09). */
  toCheck?: boolean;
  search?: OrderSearch;
  limit?: number;
  /** Rows to skip before the first one returned, for paging. */
  offset?: number;
};

/** The supplier join must be inner when searching by its name, so non-matching orders drop out. */
const SUPPLIER_JOIN = "supplier:organisations!orders_supplier_org_id_fkey(id, name)";
const SUPPLIER_INNER_JOIN = "supplier:organisations!orders_supplier_org_id_fkey!inner(id, name)";

type Filterable<Q> = {
  eq(column: string, value: string | number): Q;
  in(column: string, values: readonly string[]): Q;
  or(filters: string): Q;
  ilike(column: string, pattern: string): Q;
};

function applyFilter<Q extends Filterable<Q>>(start: Q, filter: OrderFilter): Q {
  let query = start;
  if (filter.buyerOrgId) query = query.eq("buyer_org_id", filter.buyerOrgId);
  if (filter.supplierOrgId) query = query.eq("supplier_org_id", filter.supplierOrgId);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (filter.checkStatuses) query = query.in("check_status", filter.checkStatuses);
  if (filter.toCheck) query = query.or("status.eq.out_for_delivery,and(status.eq.delivered,check_status.eq.unchecked)");
  if (filter.search?.kind === "number") query = query.eq("number", filter.search.number);
  if (filter.search?.kind === "supplier") query = query.ilike("supplier.name", `%${filter.search.text}%`);
  return query;
}

function selectFor(filter: OrderFilter): string {
  return filter.search?.kind === "supplier" ? SELECT.replace(SUPPLIER_JOIN, SUPPLIER_INNER_JOIN) : SELECT;
}

/** Orders visible to the signed-in user (RLS), newest first. */
export async function getOrders(filter: OrderFilter = {}): Promise<OrderView[]> {
  const supabase = await createSupabaseServerClient();
  const limit = filter.limit ?? 50;
  const ordered = supabase.from("orders").select(selectFor(filter)).order("created_at", { ascending: false });
  const paged = filter.offset ? ordered.range(filter.offset, filter.offset + limit - 1) : ordered.limit(limit);
  const { data, error } = await applyFilter(paged, filter);
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return z.array(rowSchema).parse(data).map(toView);
}

/** How many orders match the filter (limit and offset are ignored). */
export async function countOrders(filter: OrderFilter = {}): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const columns: string = filter.search?.kind === "supplier" ? `id, ${SUPPLIER_INNER_JOIN}` : "id";
  // An exact count ignores the limit; the limit only keeps the builder type shallow enough for applyFilter.
  const { count, error } = await applyFilter(supabase.from("orders").select(columns, { count: "exact", head: true }).limit(1), filter);
  if (error) throw new Error(`Could not count orders: ${error.message}`);
  return count ?? 0;
}

/**
 * One order visible to the signed-in user, or null when RLS hides it or it does not exist.
 * Pass the buyer's organisation to also hide orders the user sees for another reason. Cached per request.
 */
export const getOrderById = cache(async (id: string, buyerOrgId?: string): Promise<OrderView | null> => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const byId = supabase.from("orders").select(SELECT).eq("id", id);
  const { data, error } = await (buyerOrgId ? byId.eq("buyer_org_id", buyerOrgId) : byId).maybeSingle();
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  return data === null ? null : toView(rowSchema.parse(data));
});
