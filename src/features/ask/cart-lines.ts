import { readLineStatus } from "@/domain/ask/replies";
import type { CartLine, LineRow } from "@/domain/ask/types";
import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney, lineTotal } from "@/domain/money";
import type { DraftLine } from "@/features/ordering/draft";

/** Pure mapping between what the assistant shows in chat and what Add to cart puts in the draft. */

/** A read line as it goes to the cart: same product, quantity, options and state. */
export function toCartLine(line: DraftLine): CartLine {
  return {
    productId: line.productId,
    qty: line.qty,
    sourceText: line.sourceText,
    options: line.options,
    state: line.state,
    kg: line.kg,
    qtyAssumed: line.qtyAssumed,
  };
}

/** A line the assistant suggests for a catalogue product (usuals, reorder plan, a priced product). */
export function productCartLine(productId: string, qty: number, sourceText: string, state: "suggested" | "manual"): CartLine {
  return { productId, qty, sourceText, options: [], state, kg: null, qtyAssumed: false };
}

/** "2 × Fresh eggs" with the line price, or what was typed when there is no product. */
export function lineRow(line: Pick<CartLine, "productId" | "qty" | "sourceText">, byId: Map<string, CatalogueItem>, note: string | null): LineRow {
  const item = line.productId ? byId.get(line.productId) : undefined;
  return {
    label: item ? `${line.qty} × ${item.name}` : line.sourceText,
    status: null,
    note,
    price: item ? formatMoney(lineTotal(item.price, line.qty)) : null,
  };
}

/** "Here is what I read": every line with its match state and price. */
export function readRows(lines: DraftLine[], byId: Map<string, CatalogueItem>): LineRow[] {
  return lines.map((line) => ({ ...lineRow(line, byId, null), status: readLineStatus(line.state) }));
}

/**
 * A line already in the cart: "2 × Fresh eggs" with its supplier and price, or what was typed
 * with "Check this" or "Not found" when it has no product the buyer can order.
 */
export function cartRow(line: Pick<DraftLine, "productId" | "qty" | "sourceText" | "state">, byId: Map<string, CatalogueItem>): LineRow {
  const item = line.productId ? byId.get(line.productId) : undefined;
  if (item) return lineRow(line, byId, item.supplierName);
  return { ...lineRow(line, byId, null), status: line.state === "check" ? "Check this" : "Not found" };
}

/** Worth offering Add to cart: at least one line matched or has candidate products. */
export function hasUsableLine(lines: Pick<DraftLine, "productId" | "options">[]): boolean {
  return lines.some((line) => line.productId !== null || line.options.length > 0);
}

/**
 * Checks lines sent back from the browser against the buyer's own catalogue before they go to the
 * draft. A line without a product the buyer can see waits in the cart as "Check this" (candidates
 * remain) or "Not in catalogue".
 */
export function linesForCatalogue(lines: CartLine[], visible: Set<string>): CartLine[] {
  return lines.map((line) => {
    const options = line.options.filter((id) => visible.has(id));
    if (line.productId !== null && visible.has(line.productId)) return { ...line, options };
    return { ...line, productId: null, options, state: options.length > 0 ? "check" : "not_found" };
  });
}
