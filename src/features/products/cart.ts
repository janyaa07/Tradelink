import { MAX_LINE_QTY } from "@/domain/review";
import type { DraftLine } from "@/features/ordering/draft";

/** Pure cart edits for the Products page. The cart is the buyer's order draft. */

export function clampQuantity(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.min(MAX_LINE_QTY, Math.trunc(qty)));
}

/** Total quantity of one product across the cart lines. */
export function productQuantity(lines: readonly DraftLine[], productId: string): number {
  return lines.reduce((sum, line) => (line.productId === productId ? sum + line.qty : sum), 0);
}

/**
 * Sets the total quantity of one product in the cart. A product not in the cart gets a new
 * "Added by you" line. More goes on the first line for the product. Less comes off the last
 * lines first, and a line that reaches 0 is removed, so 0 removes the product. Returns the same
 * array when nothing changes.
 */
export function setProductQuantity(lines: DraftLine[], productId: string, target: number, newId: string): DraftLine[] {
  const want = clampQuantity(target);
  const current = productQuantity(lines, productId);
  if (want === current) return lines;
  if (current === 0) {
    return [
      ...lines,
      { id: newId, sourceText: "Added by you", productId, qty: want, kg: null, qtyAssumed: false, options: [], state: "manual" },
    ];
  }

  const indexes = lines.flatMap((line, index) => (line.productId === productId ? [index] : []));
  const next = [...lines];
  if (want > current) {
    const first = indexes[0];
    const line = first === undefined ? undefined : next[first];
    if (first === undefined || !line) return lines;
    next[first] = { ...line, qty: Math.min(MAX_LINE_QTY, line.qty + want - current), qtyAssumed: false, kg: null };
    return next;
  }

  let excess = current - want;
  for (const index of [...indexes].reverse()) {
    const line = next[index];
    if (excess <= 0 || !line) break;
    const take = Math.min(line.qty, excess);
    excess -= take;
    next[index] = { ...line, qty: line.qty - take, qtyAssumed: false, kg: null };
  }
  return next.filter((line) => line.qty > 0);
}

/**
 * The number of cart lines to show while changes are on their way: the saved count, plus one for
 * each product newly added, minus one for each product removed.
 */
export function shownLineCount(savedCount: number, saved: Record<string, number>, shown: Record<string, number>): number {
  let count = savedCount;
  for (const productId of new Set([...Object.keys(saved), ...Object.keys(shown)])) {
    const before = (saved[productId] ?? 0) > 0;
    const after = (shown[productId] ?? 0) > 0;
    if (after && !before) count += 1;
    if (before && !after) count -= 1;
  }
  return Math.max(0, count);
}

/** The toast after a change, for example "Eggs added to cart." */
export function cartMessage(name: string, before: number, after: number): string {
  if (after <= 0) return `${name} removed from cart.`;
  if (before <= 0) return `${name} added to cart.`;
  return `${name}: ${after} in cart.`;
}
