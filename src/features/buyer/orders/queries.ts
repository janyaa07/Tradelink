import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrderSearch } from "@/features/orders/queries";
import { ISSUE_STATUSES, ISSUE_TYPES, type IssueFacts } from "./summary";

/** A problem the buyer reported on one of their orders. */
export type BuyerIssue = IssueFacts & {
  id: string;
  number: number;
  orderId: string;
  orderNumber: number;
  note: string | null;
  createdAt: string;
  answeredAt: string | null;
};

export type IssueFilter = {
  orgId: string;
  orderId?: string;
  search?: OrderSearch;
  /** Only problems the supplier has not answered. */
  openOnly?: boolean;
  limit?: number;
};

const money = z.union([z.string(), z.number()]).transform((value) => Number(value).toFixed(2));

const issueSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  type: z.enum(ISSUE_TYPES),
  status: z.enum(ISSUE_STATUSES),
  qty: z.number(),
  amount: money,
  note: z.string().nullable(),
  created_at: z.string(),
  answered_at: z.string().nullable(),
  product: z.object({ name: z.string() }).nullable(),
  supplier: z.object({ name: z.string() }).nullable(),
  parent: z.object({ id: z.uuid(), number: z.number() }),
});

const PRODUCT = "product:products(name)";
const PARENT = "parent:orders!inner(id, number)";

function supplierJoin(search: OrderSearch | undefined): string {
  const inner = search?.kind === "supplier" ? "!inner" : "";
  return `supplier:organisations!issues_supplier_org_id_fkey${inner}(name)`;
}

type Filterable<Q> = {
  eq(column: string, value: string | number): Q;
  ilike(column: string, pattern: string): Q;
};

function applyFilter<Q extends Filterable<Q>>(start: Q, filter: IssueFilter): Q {
  let query = start.eq("buyer_org_id", filter.orgId);
  if (filter.orderId) query = query.eq("order_id", filter.orderId);
  if (filter.openOnly) query = query.eq("status", "open");
  if (filter.search?.kind === "number") query = query.eq("parent.number", filter.search.number);
  if (filter.search?.kind === "supplier") query = query.ilike("supplier.name", `%${filter.search.text}%`);
  return query;
}

/** Problems the buyer reported (RLS: own business only), newest first. */
export async function getBuyerIssues(filter: IssueFilter): Promise<BuyerIssue[]> {
  const supabase = await createSupabaseServerClient();
  const select = `id, number, type, status, qty, amount, note, created_at, answered_at, ${PRODUCT}, ${supplierJoin(filter.search)}, ${PARENT}`;
  const ordered = supabase.from("issues").select(select).order("created_at", { ascending: false }).limit(filter.limit ?? 100);
  const { data, error } = await applyFilter(ordered, filter);
  if (error) throw new Error(`Could not load problems: ${error.message}`);
  return z
    .array(issueSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      number: row.number,
      orderId: row.parent.id,
      orderNumber: row.parent.number,
      type: row.type,
      status: row.status,
      qty: row.qty,
      amount: row.amount,
      note: row.note,
      createdAt: row.created_at,
      answeredAt: row.answered_at,
      productName: row.product?.name ?? null,
      supplierName: row.supplier?.name ?? "Your supplier",
    }));
}

/** How many problems match the filter (limit is ignored). */
export async function countBuyerIssues(filter: IssueFilter): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const columns: string = `id, ${supplierJoin(filter.search)}, ${PARENT}`;
  // An exact count ignores the limit; the limit only keeps the builder type shallow enough for applyFilter.
  const { count, error } = await applyFilter(supabase.from("issues").select(columns, { count: "exact", head: true }).limit(1), filter);
  if (error) throw new Error(`Could not count problems: ${error.message}`);
  return count ?? 0;
}
