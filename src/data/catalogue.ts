import "server-only";
import { z } from "zod";
import { ART_KINDS, CATEGORIES, UNITS, type CatalogueItem } from "@/domain/catalogue";
import { createSupabaseServerClient } from "./supabase/server";

const rowSchema = z.object({
  id: z.uuid(),
  supplier_org_id: z.uuid(),
  supplier_name: z.string(),
  sku: z.string(),
  name: z.string(),
  unit: z.enum(UNITS),
  price: z.union([z.string(), z.number()]),
  category: z.enum(CATEGORIES),
  art: z.enum(ART_KINDS),
  pack_kg: z.union([z.string(), z.number()]).nullable(),
  reorder_level: z.number(),
  aliases: z.array(z.string()),
  status: z.enum(["active", "unconfirmed"]),
  on_hand: z.number(),
  reserved: z.number(),
  available: z.number(),
  health: z.enum(["healthy", "low", "out", "unconfirmed"]),
});

function toItem(row: z.infer<typeof rowSchema>): CatalogueItem {
  return {
    id: row.id,
    supplierOrgId: row.supplier_org_id,
    supplierName: row.supplier_name,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    price: Number(row.price).toFixed(2),
    category: row.category,
    art: row.art,
    packKg: row.pack_kg === null ? null : Number(row.pack_kg),
    reorderLevel: row.reorder_level,
    aliases: row.aliases,
    status: row.status,
    onHand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
    health: row.health,
  };
}

/**
 * Products the signed-in user can see (RLS): for a buyer, its connected open suppliers;
 * for a supplier, its own products. Optionally limited to one supplier.
 */
export async function getCatalogue(options: { supplierOrgId?: string } = {}): Promise<CatalogueItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("v_catalogue").select("*").order("name");
  if (options.supplierOrgId) query = query.eq("supplier_org_id", options.supplierOrgId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load the catalogue: ${error.message}`);
  return z.array(rowSchema).parse(data).map(toItem);
}
