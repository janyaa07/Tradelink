import type { CatalogueItem } from "@/domain/catalogue";
import { packsForWeight } from "@/domain/reader/rules";
import type { DraftLine } from "./draft";

/** Pure edits to the cart lines. Each returns a new array. */

function update(lines: DraftLine[], id: string, change: (line: DraftLine) => DraftLine): DraftLine[] {
  return lines.map((line) => (line.id === id ? change(line) : line));
}

/** Sets or clears a line's product. Weights become whole packs when the product has a pack weight (BUY-15). */
export function pickProduct(lines: DraftLine[], id: string, item: CatalogueItem | null): DraftLine[] {
  return update(lines, id, (line) => {
    if (!item) return { ...line, productId: null, state: line.options.length > 0 ? "check" : "not_found" };
    const state = line.state === "manual" || line.state === "suggested" ? line.state : "matched";
    if (line.kg === null) return { ...line, productId: item.id, state };
    if (item.packKg) return { ...line, productId: item.id, qty: packsForWeight(line.kg, item.packKg), state };
    return { ...line, productId: item.id, kg: null, state };
  });
}

export function setQuantity(lines: DraftLine[], id: string, qty: number): DraftLine[] {
  return update(lines, id, (line) => ({ ...line, qty, qtyAssumed: false, kg: null }));
}

export function removeLine(lines: DraftLine[], id: string): DraftLine[] {
  return lines.filter((line) => line.id !== id);
}

/** "Use {product} instead" (BUY-16). */
export function swapProduct(lines: DraftLine[], id: string, productId: string): DraftLine[] {
  return update(lines, id, (line) => ({ ...line, productId, kg: null, state: "matched" }));
}

/** After "Add to catalogue": the line takes the new unconfirmed product (BUY-18). */
export function markAdded(lines: DraftLine[], id: string, productId: string): DraftLine[] {
  return update(lines, id, (line) => ({ ...line, productId, kg: null, options: [], state: "added" }));
}

/** Quantity of each product across the lines, for "{n} in cart". */
export function quantitiesByProduct(lines: DraftLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.productId) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.qty);
  }
  return totals;
}
