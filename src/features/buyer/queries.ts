import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getCatalogue } from "@/data/catalogue";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { CatalogueItem } from "@/domain/catalogue";
import { DEFAULT_TERMS, type DeliveryTerms } from "@/domain/cutoff";
import { toCents, type Cents } from "@/domain/money";
import { singaporeDateOf, startOfWeekSingapore } from "@/domain/singapore-time";
import { getOrders, OPEN_STATUSES, type OrderView } from "@/features/orders/queries";

const numeric = z.union([z.string(), z.number()]).transform(Number);
const money = z.union([z.string(), z.number()]).transform((value) => Number(value).toFixed(2));

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

/** The buyer's catalogue (connected, open suppliers only, through RLS). Cached per request. */
export const getBuyerCatalogue = cache((): Promise<CatalogueItem[]> => getCatalogue());

export type BuyerSettings = { weeklyBudget: string; suggestReorder: boolean; priceAlerts: boolean; budgetWarning: boolean };

const settingsSchema = z.object({
  weekly_budget: money,
  suggest_reorder: z.boolean(),
  price_alerts: z.boolean(),
  budget_warning: z.boolean(),
});

/** Settings shared by everyone in the business; the schema defaults apply until first saved. */
export const getBuyerSettings = cache(async (orgId: string): Promise<BuyerSettings> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("buyer_settings")
    .select("weekly_budget, suggest_reorder, price_alerts, budget_warning")
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (error) fail("settings", error.message);
  if (!data) return { weeklyBudget: "900.00", suggestReorder: true, priceAlerts: true, budgetWarning: true };
  const row = settingsSchema.parse(data);
  return {
    weeklyBudget: row.weekly_budget,
    suggestReorder: row.suggest_reorder,
    priceAlerts: row.price_alerts,
    budgetWarning: row.budget_warning,
  };
});

export type UsualItem = { productId: string; usualQty: number; usePerDay: number; inShop: number; lastPaid: string | null };

const usualSchema = z.object({
  product_id: z.uuid(),
  usual_qty: z.number(),
  use_per_day: numeric,
  in_shop: numeric,
  last_paid: money.nullable(),
});

export const getUsualItems = cache(async (orgId: string): Promise<UsualItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("usual_items")
    .select("product_id, usual_qty, use_per_day, in_shop, last_paid")
    .eq("buyer_org_id", orgId);
  if (error) fail("usual items", error.message);
  return z
    .array(usualSchema)
    .parse(data)
    .map((row) => ({
      productId: row.product_id,
      usualQty: row.usual_qty,
      usePerDay: row.use_per_day,
      inShop: row.in_shop,
      lastPaid: row.last_paid,
    }));
});

const openOrderSchema = z.object({ order_lines: z.array(z.object({ product_id: z.uuid(), qty: z.number() })) });

/** Quantity of each product on the buyer's open orders (pending, accepted, out for delivery). */
export const getOnOrder = cache(async (orgId: string): Promise<Map<string, number>> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("orders").select("order_lines(product_id, qty)").eq("buyer_org_id", orgId).in("status", OPEN_STATUSES);
  if (error) fail("open orders", error.message);
  const totals = new Map<string, number>();
  for (const order of z.array(openOrderSchema).parse(data)) {
    for (const line of order.order_lines) totals.set(line.product_id, (totals.get(line.product_id) ?? 0) + line.qty);
  }
  return totals;
});

const spendSchema = z.object({ order_lines: z.array(z.object({ qty: z.number(), unit_price: money })) });

/** Orders placed since Monday 00:00 in Singapore, excluding rejected and cancelled ones. */
async function spendBetweenCents(orgId: string, from: Date, to: Date): Promise<Cents> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_lines(qty, unit_price)")
    .eq("buyer_org_id", orgId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .not("status", "in", "(rejected,cancelled)");
  if (error) fail("spend", error.message);
  return z
    .array(spendSchema)
    .parse(data)
    .flatMap((order) => order.order_lines)
    .reduce((sum, line) => sum + toCents(line.unit_price) * line.qty, 0);
}

export const getWeekSpendCents = cache(async (orgId: string): Promise<Cents> => {
  const now = new Date();
  return spendBetweenCents(orgId, startOfWeekSingapore(now), new Date(now.getTime() + 60_000));
});

/** Last week's spend up to the same point in the week, for a fair comparison on Home. */
export const getLastWeekSpendCents = cache(async (orgId: string): Promise<Cents> => {
  const now = new Date();
  const week = 7 * 24 * 60 * 60 * 1000;
  return spendBetweenCents(orgId, new Date(startOfWeekSingapore(now).getTime() - week), new Date(now.getTime() - week));
});

/** Products the buyer chose "Not today" for, today in Singapore. */
export const getSkippedToday = cache(async (orgId: string): Promise<Set<string>> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restock_skips")
    .select("product_id")
    .eq("buyer_org_id", orgId)
    .eq("skip_date", singaporeDateOf(new Date()));
  if (error) fail("skipped items", error.message);
  return new Set(
    z
      .array(z.object({ product_id: z.uuid() }))
      .parse(data)
      .map((row) => row.product_id),
  );
});

const termsSchema = z.object({
  organisation_id: z.uuid(),
  cutoff_time: z.string(),
  delivery_days: z.array(z.number()),
  lead_time_days: z.number(),
  minimum_order: money,
});

/** Cut-off, delivery days and lead time per supplier; defaults when a supplier has no profile yet. */
export async function getDeliveryTerms(supplierIds: string[]): Promise<Map<string, DeliveryTerms>> {
  const terms = new Map<string, DeliveryTerms>(supplierIds.map((id) => [id, DEFAULT_TERMS]));
  if (supplierIds.length === 0) return terms;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("supplier_profiles")
    .select("organisation_id, cutoff_time, delivery_days, lead_time_days, minimum_order")
    .in("organisation_id", supplierIds);
  if (error) fail("delivery terms", error.message);
  for (const row of z.array(termsSchema).parse(data)) {
    terms.set(row.organisation_id, {
      cutoffTime: row.cutoff_time,
      deliveryDays: row.delivery_days,
      leadTimeDays: row.lead_time_days,
      minimumOrder: row.minimum_order,
    });
  }
  return terms;
}

export type ConnectedSupplier = { id: string; name: string; status: "active" | "invited" };

const connectionSchema = z.object({
  supplier: z.object({ id: z.uuid(), name: z.string(), status: z.enum(["invited", "active", "suspended", "declined"]) }).nullable(),
});

/** Suppliers this buyer can order from: connected, and active or invited. */
export const getConnectedSuppliers = cache(async (orgId: string): Promise<ConnectedSupplier[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("trading_connections")
    .select("supplier:organisations!trading_connections_supplier_org_id_fkey(id, name, status)")
    .eq("buyer_org_id", orgId)
    .in("status", ["active", "invited"]);
  if (error) fail("suppliers", error.message);
  return z
    .array(connectionSchema)
    .parse(data)
    .flatMap(({ supplier }) =>
      supplier && (supplier.status === "active" || supplier.status === "invited")
        ? [{ id: supplier.id, name: supplier.name, status: supplier.status }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
});

/** Orders out for delivery, or delivered and not yet checked (BUY-09). */
export const getDeliveriesToCheck = cache(async (orgId: string): Promise<OrderView[]> => {
  const orders = await getOrders({ buyerOrgId: orgId, statuses: ["out_for_delivery", "delivered"], limit: 100 });
  return orders.filter((order) => order.status === "out_for_delivery" || order.checkStatus === "unchecked");
});
