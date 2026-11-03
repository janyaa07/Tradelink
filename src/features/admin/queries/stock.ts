import "server-only";
import { z } from "zod";
import { ART_KINDS } from "@/domain/catalogue";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { selectAll } from "./fetch";

/** Low means at or below the reorder level, including out of stock (prototype isLow). */
export const LOW_HEALTH = ["low", "out"] as const;

export type ProductCounts = { products: number; low: number };

/** Products and low-stock products per supplier, from `v_catalogue` (hidden products excluded). */
export async function getProductCountsBySupplier(): Promise<Map<string, ProductCounts>> {
  const supabase = await createSupabaseServerClient();
  const rows = await selectAll(
    z.object({ supplier_org_id: z.uuid(), health: z.enum(["healthy", "low", "out", "unconfirmed"]) }),
    "product counts",
    (from, to) => supabase.from("v_catalogue").select("supplier_org_id, health").order("id").range(from, to),
  );
  const counts = new Map<string, ProductCounts>();
  for (const row of rows) {
    const current = counts.get(row.supplier_org_id) ?? { products: 0, low: 0 };
    const low = row.health === "low" || row.health === "out";
    counts.set(row.supplier_org_id, { products: current.products + 1, low: current.low + (low ? 1 : 0) });
  }
  return counts;
}

const lowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sku: z.string(),
  art: z.enum(ART_KINDS),
  supplier_org_id: z.uuid(),
  supplier_name: z.string(),
  health: z.enum(["low", "out"]),
  available: z.number(),
  reorder_level: z.number(),
});

export type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  art: (typeof ART_KINDS)[number];
  supplierOrgId: string;
  supplierName: string;
  health: "low" | "out";
  available: number;
  reorderLevel: number;
};

/** Low and out-of-stock products across the platform, emptiest first. */
export async function getLowStock(limit: number): Promise<{ items: LowStockItem[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("v_catalogue")
    .select("id, name, sku, art, supplier_org_id, supplier_name, health, available, reorder_level", { count: "exact" })
    .in("health", [...LOW_HEALTH])
    .order("available")
    .order("name")
    .limit(limit);
  const { data, error, count } = await query;
  if (error) throw new Error(`Could not load low stock: ${error.message}`);
  const rows = z.array(lowSchema).parse(data);
  return {
    total: count ?? rows.length,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      art: row.art,
      supplierOrgId: row.supplier_org_id,
      supplierName: row.supplier_name,
      health: row.health,
      available: row.available,
      reorderLevel: row.reorder_level,
    })),
  };
}
