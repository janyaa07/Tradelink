import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ART_KINDS } from "@/domain/catalogue";
import { getOrderById, type OrderView } from "@/features/orders/queries";
import { ISSUE_STATUSES, ISSUE_TYPES, type IssueView, type OrderIssueView } from "./issues";
import type { MovementType } from "./stock";

const decimal = z.union([z.string(), z.number()]).transform((value) => Number(value).toFixed(2));

const issueRow = z.object({
  id: z.uuid(),
  type: z.enum(ISSUE_TYPES),
  qty: z.number(),
  amount: decimal,
  note: z.string().nullable(),
  created_at: z.string(),
  order: z.object({ number: z.number() }),
  buyer: z.object({ name: z.string() }),
  product: z.object({ name: z.string() }).nullable(),
});

const ISSUE_SELECT = `id, type, qty, amount, note, created_at,
  order:orders!issues_order_id_fkey(number),
  buyer:organisations!issues_buyer_org_id_fkey(name),
  product:products!issues_product_id_fkey(name)`;

function toIssueView(row: z.infer<typeof issueRow>): IssueView {
  return {
    id: row.id,
    type: row.type,
    qty: row.qty,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at,
    orderNumber: row.order.number,
    buyerName: row.buyer.name,
    productName: row.product?.name ?? null,
  };
}

/** Open problems on this supplier's orders, oldest first so the longest wait is answered first. */
export async function getOpenIssues(supplierOrgId: string): Promise<IssueView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_SELECT)
    .eq("supplier_org_id", supplierOrgId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load problems: ${error.message}`);
  return z.array(issueRow).parse(data).map(toIssueView);
}

/** A supplier's own order (RLS), or null when it is missing or belongs to another supplier. */
export async function getSupplierOrder(id: string, supplierOrgId: string): Promise<OrderView | null> {
  const order = await getOrderById(id);
  return order && order.supplier.id === supplierOrgId ? order : null;
}

/** Every problem on one of this supplier's orders, answered or not, oldest first. */
export async function getOrderIssues(supplierOrgId: string, orderId: string): Promise<OrderIssueView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("issues")
    .select(`status, ${ISSUE_SELECT}`)
    .eq("supplier_org_id", supplierOrgId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(`Could not load problems: ${error.message}`);
  return z
    .array(issueRow.extend({ status: z.enum(ISSUE_STATUSES) }))
    .parse(data)
    .map((row) => ({ ...toIssueView(row), status: row.status }));
}

const contactRow = z.object({
  contact_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});

export type BuyerContact = { contact: string; phone: string; email: string; address: string };

/** A connected buyer's contact details (RLS), or null when the buyer is no longer visible. */
export async function getBuyerContact(buyerOrgId: string): Promise<BuyerContact | null> {
  if (!z.uuid().safeParse(buyerOrgId).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organisations").select("contact_name, phone, email, address").eq("id", buyerOrgId).maybeSingle();
  if (error) throw new Error(`Could not load the buyer's details: ${error.message}`);
  if (data === null) return null;
  const row = contactRow.parse(data);
  return { contact: row.contact_name ?? "", phone: row.phone ?? "", email: row.email ?? "", address: row.address ?? "" };
}

/** Pending orders waiting for this supplier, for the nav count. */
export async function countNewOrders(supplierOrgId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("supplier_org_id", supplierOrgId)
    .eq("status", "pending");
  if (error) throw new Error(`Could not count new orders: ${error.message}`);
  return count ?? 0;
}

const movementRow = z.object({
  id: z.number(),
  type: z.enum(["received", "reserved", "released", "delivered", "adjusted"]),
  on_hand_change: z.number(),
  reserved_change: z.number(),
  reason: z.string().nullable(),
  source: z.string(),
  created_at: z.string(),
  product: z.object({ name: z.string(), art: z.enum(ART_KINDS) }),
});

export type MovementView = {
  id: number;
  type: MovementType;
  onHandChange: number;
  reservedChange: number;
  reason: string | null;
  source: string;
  createdAt: string;
  productName: string;
  art: (typeof ART_KINDS)[number];
};

/** Every stock change for the signed-in supplier's products (RLS), newest first (SUP-16). */
export async function getStockMovements(limit = 200): Promise<MovementView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, type, on_hand_change, reserved_change, reason, source, created_at, product:products(name, art)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load stock history: ${error.message}`);
  return z
    .array(movementRow)
    .parse(data)
    .map((row) => ({
      id: row.id,
      type: row.type,
      onHandChange: row.on_hand_change,
      reservedChange: row.reserved_change,
      reason: row.reason,
      source: row.source,
      createdAt: row.created_at,
      productName: row.product.name,
      art: row.product.art,
    }));
}

const activityRow = z.object({
  id: z.number(),
  at: z.string(),
  actor_name: z.string().nullable(),
  actor_org_name: z.string().nullable(),
  action: z.string(),
  outcome: z.enum(["allowed", "denied"]),
});

export type ActivityView = {
  id: number;
  at: string;
  who: string;
  action: string;
  denied: boolean;
};

/** Audit entries involving the organisation, newest first (SUP-17). */
export async function getActivity(orgId: string, limit = 100): Promise<ActivityView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, at, actor_name, actor_org_name, action, outcome")
    .or(`actor_org_id.eq.${orgId},related_org_ids.cs.{${orgId}}`)
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load activity: ${error.message}`);
  return z
    .array(activityRow)
    .parse(data)
    .map((row) => ({
      id: row.id,
      at: row.at,
      who: [row.actor_name, row.actor_org_name].filter(Boolean).join(", ") || "Tradelink",
      action: row.action,
      denied: row.outcome === "denied",
    }));
}

const profileRow = z.object({
  name: z.string(),
  contact_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  supplier_profiles: z
    .object({
      product_range: z.string().nullable(),
      delivery_days: z.array(z.number()),
      lead_time_days: z.number(),
      cutoff_time: z.string(),
      minimum_order: decimal,
    })
    .nullable(),
});

export type BusinessProfile = {
  business: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  range: string;
  days: number[];
  leadDays: number;
  /** "16:00:00" as stored. */
  cutoff: string;
  /** Decimal string such as "80.00". */
  minimum: string;
};

/** The supplier's business profile (SUP-18). Defaults match the table defaults until it is saved. */
export async function getBusinessProfile(orgId: string): Promise<BusinessProfile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organisations")
    .select("name, contact_name, phone, email, address, supplier_profiles(product_range, delivery_days, lead_time_days, cutoff_time, minimum_order)")
    .eq("id", orgId)
    .single();
  if (error) throw new Error(`Could not load the business profile: ${error.message}`);
  const row = profileRow.parse(data);
  const profile = row.supplier_profiles;
  return {
    business: row.name,
    contact: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    range: profile?.product_range ?? "",
    days: profile?.delivery_days ?? [1, 2, 3, 4, 5, 6],
    leadDays: profile?.lead_time_days ?? 1,
    cutoff: profile?.cutoff_time ?? "16:00:00",
    minimum: profile?.minimum_order ?? "0.00",
  };
}
