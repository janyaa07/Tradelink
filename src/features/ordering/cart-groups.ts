import type { CatalogueItem } from "@/domain/catalogue";
import type { DraftLine } from "./draft";

export type SupplierLines = { supplierOrgId: string; supplierName: string; lines: DraftLine[] };

export type CartGroups = {
  /** Lines with no product the buyer can order yet: they block placing until resolved. */
  unresolved: DraftLine[];
  /** One group per supplier, which is how the cart splits into orders, sorted by supplier name. */
  suppliers: SupplierLines[];
};

/** Groups the cart for display, keeping each group's lines in cart order. */
export function groupCartLines(lines: DraftLine[], byId: Map<string, CatalogueItem>): CartGroups {
  const unresolved: DraftLine[] = [];
  const groups = new Map<string, SupplierLines>();
  for (const line of lines) {
    const item = line.productId ? byId.get(line.productId) : undefined;
    if (!item) {
      unresolved.push(line);
      continue;
    }
    const group = groups.get(item.supplierOrgId) ?? { supplierOrgId: item.supplierOrgId, supplierName: item.supplierName, lines: [] };
    group.lines.push(line);
    groups.set(item.supplierOrgId, group);
  }
  return { unresolved, suppliers: [...groups.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName)) };
}
