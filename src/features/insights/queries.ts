import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  budgetLeft,
  onTimePercent,
  overchargesCaughtCents,
  priceChangeSplit,
  spendBySupplier,
  supplierSlices,
  weekStarts,
  weeklySpend,
  type SpendOrder,
  type WeekSpend,
} from "@/domain/insights";
import { DEFAULT_TERMS } from "@/domain/cutoff";
import { toCents, type Cents } from "@/domain/money";
import { getBuyerSettings, getConnectedSuppliers, getDeliveryTerms, getUsualItems } from "@/features/buyer/queries";

const money = z.union([z.string(), z.number()]).transform((value) => Number(value).toFixed(2));

/** Rows per request; matches the Supabase API's default maximum. */
const PAGE_SIZE = 1000;
const PRICE_CHANGES_SHOWN = 20;

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

type PageResult = { data: unknown; error: { message: string } | null };

/** Reads every matching row, a page at a time, so totals are never cut short by the row limit. */
async function readAll<T>(what: string, schema: z.ZodType<T>, page: (from: number, to: number) => PromiseLike<PageResult>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) fail(what, error.message);
    const batch = z.array(schema).parse(data);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

const spendOrderSchema = z.object({
  status: z.string(),
  supplier_org_id: z.uuid(),
  created_at: z.string(),
  supplier: z.object({ name: z.string() }).nullable(),
  order_lines: z.array(z.object({ qty: z.number(), unit_price: money })),
});

type WindowSpend = { orders: SpendOrder[]; supplierNames: Map<string, string> };

/** The buyer's orders placed since Monday 00:00 in Singapore four weeks ago, with their lines. */
async function getWindowOrders(orgId: string, since: Date): Promise<WindowSpend> {
  const supabase = await createSupabaseServerClient();
  const rows = await readAll("spend", spendOrderSchema, (from, to) =>
    supabase
      .from("orders")
      .select("status, supplier_org_id, created_at, supplier:organisations!orders_supplier_org_id_fkey(name), order_lines(qty, unit_price)")
      .eq("buyer_org_id", orgId)
      .gte("created_at", since.toISOString())
      .order("id")
      .range(from, to),
  );
  const supplierNames = new Map<string, string>();
  for (const row of rows) if (row.supplier) supplierNames.set(row.supplier_org_id, row.supplier.name);
  return {
    supplierNames,
    orders: rows.map((row) => ({
      status: row.status,
      supplierId: row.supplier_org_id,
      createdAt: row.created_at,
      lines: row.order_lines.map((line) => ({ qty: line.qty, unitPrice: line.unit_price })),
    })),
  };
}

const recordOrderSchema = z.object({
  supplier_org_id: z.uuid(),
  status: z.string(),
  confirmed_delivery_date: z.string().nullable(),
  delivered_at: z.string().nullable(),
});

/** Every order the buyer placed with these suppliers, without lines. */
async function getRecordOrders(orgId: string, supplierIds: string[]) {
  if (supplierIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  return readAll("supplier record", recordOrderSchema, (from, to) =>
    supabase
      .from("orders")
      .select("supplier_org_id, status, confirmed_delivery_date, delivered_at")
      .eq("buyer_org_id", orgId)
      .in("supplier_org_id", supplierIds)
      .order("id")
      .range(from, to),
  );
}

const issueSchema = z.object({ supplier_org_id: z.uuid(), status: z.string(), amount: money });

/** Every problem the buyer reported, with its status and amount. */
async function getIssues(orgId: string) {
  const supabase = await createSupabaseServerClient();
  return readAll("problems", issueSchema, (from, to) =>
    supabase.from("issues").select("supplier_org_id, status, amount").eq("buyer_org_id", orgId).order("id").range(from, to),
  );
}

export type PriceChangeRow = { id: string; productName: string; createdAt: string; oldPrice: string; newPrice: string };

const priceChangeSchema = z.object({
  id: z.uuid(),
  old_price: money,
  new_price: money,
  created_at: z.string(),
  product: z.object({ name: z.string() }).nullable(),
});

const priceMoveSchema = z.object({ old_price: money, new_price: money });

type PriceChanges = { total: number; up: number; down: number; latest: PriceChangeRow[] };

/** Price changes on the buyer's usual items: the latest, newest first, with the full count and how many went up or down (BUY-41). */
export async function getPriceChanges(productIds: string[]): Promise<PriceChanges> {
  if (productIds.length === 0) return { total: 0, up: 0, down: 0, latest: [] };
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, moves] = await Promise.all([
    supabase
      .from("price_changes")
      .select("id, old_price, new_price, created_at, product:products(name)")
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .limit(PRICE_CHANGES_SHOWN),
    readAll("price changes", priceMoveSchema, (from, to) =>
      supabase.from("price_changes").select("old_price, new_price").in("product_id", productIds).order("id").range(from, to),
    ),
  ]);
  if (error) fail("price changes", error.message);
  const latest = z
    .array(priceChangeSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      productName: row.product?.name ?? "A usual item",
      createdAt: row.created_at,
      oldPrice: row.old_price,
      newPrice: row.new_price,
    }));
  const { up, down } = priceChangeSplit(moves.map((move) => ({ oldPrice: move.old_price, newPrice: move.new_price })));
  return { total: Math.max(moves.length, latest.length), up, down, latest };
}

export type SupplierSpendRow = {
  /** Null for "Other", the smallest suppliers folded together. */
  id: string | null;
  name: string;
  cents: Cents;
  /** Whole percent of the five weeks' spend; the rows add up to 100. */
  percent: number;
  /** Categorical colour slot from 0, kept per supplier; null for "Other". */
  slot: number | null;
};

export type SupplierRecordRow = {
  id: string;
  name: string;
  /** Whole percent delivered on or before the confirmed date; null when nothing has been delivered. */
  onTime: number | null;
  problems: number;
  /** "16:00", Singapore time. */
  cutoff: string;
};

export type Insights = {
  spentCents: Cents;
  lastWeekCents: Cents;
  budgetCents: Cents;
  leftCents: Cents;
  overBudget: boolean;
  caughtCents: Cents;
  weeks: WeekSpend[];
  bySupplier: SupplierSpendRow[];
  record: SupplierRecordRow[];
  priceChangeCount: number;
  priceChangesUp: number;
  priceChangesDown: number;
  priceChanges: PriceChangeRow[];
};

/** Everything on the Insights page, from the buyer's own orders, problems and usual items (BUY-38 to BUY-41). */
export async function getInsights(orgId: string, now: Date): Promise<Insights> {
  const since = weekStarts(now)[0] ?? now;
  const [settings, usuals, suppliers, window, issues] = await Promise.all([
    getBuyerSettings(orgId),
    getUsualItems(orgId),
    getConnectedSuppliers(orgId),
    getWindowOrders(orgId, since),
    getIssues(orgId),
  ]);
  const active = suppliers.filter((supplier) => supplier.status === "active");
  const activeIds = active.map((supplier) => supplier.id);
  const [recordOrders, terms, priceChanges] = await Promise.all([
    getRecordOrders(orgId, activeIds),
    getDeliveryTerms(activeIds),
    getPriceChanges(usuals.map((usual) => usual.productId)),
  ]);

  const weeks = weeklySpend(window.orders, now);
  const spentCents = weeks.at(-1)?.cents ?? 0;
  const lastWeekCents = weeks.at(-2)?.cents ?? 0;
  const budgetCents = toCents(settings.weeklyBudget);
  const { left, over } = budgetLeft(budgetCents, spentCents);

  const orderedFrom = new Set(recordOrders.map((order) => order.supplier_org_id));
  const record = active
    .filter((supplier) => orderedFrom.has(supplier.id))
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      onTime: onTimePercent(
        recordOrders
          .filter((order) => order.supplier_org_id === supplier.id && order.status === "delivered")
          .map((order) => ({ deliveredAt: order.delivered_at, confirmedDate: order.confirmed_delivery_date })),
      ),
      problems: issues.filter((issue) => issue.supplier_org_id === supplier.id).length,
      cutoff: (terms.get(supplier.id) ?? DEFAULT_TERMS).cutoffTime.slice(0, 5),
    }));

  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const byName = [...suppliers].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map((supplier) => supplier.id);
  const bySupplier = supplierSlices(spendBySupplier(window.orders), byName).map(({ supplierId, cents, percent, slot }) => ({
    id: supplierId,
    name: supplierId === null ? "Other suppliers" : (names.get(supplierId) ?? window.supplierNames.get(supplierId) ?? "A former supplier"),
    cents,
    percent,
    slot,
  }));

  return {
    spentCents,
    lastWeekCents,
    budgetCents,
    leftCents: left,
    overBudget: over,
    caughtCents: overchargesCaughtCents(issues),
    weeks,
    bySupplier,
    record,
    priceChangeCount: priceChanges.total,
    priceChangesUp: priceChanges.up,
    priceChangesDown: priceChanges.down,
    priceChanges: priceChanges.latest,
  };
}
