import { formatMoney, type Cents } from "./money";

/** A usual item that could take a supplier's order up to its minimum, at the buyer's usual quantity. */
export type TopUpOption = { productId: string; name: string; qty: number; totalCents: Cents };

const MAX_TOP_UPS = 5;

/** How far a supplier's part of the cart is under its minimum order; 0 when it is not (BUY-24). */
export function minimumGap(subtotalCents: Cents, minimumCents: Cents): Cents {
  return minimumCents > 0 && subtotalCents > 0 && subtotalCents < minimumCents ? minimumCents - subtotalCents : 0;
}

/** "Below Island Spice Traders' S$40.00 minimum by S$38.05." */
export function belowMinimumText(supplierName: string, minimumCents: Cents, gapCents: Cents): string {
  const owner = supplierName.endsWith("s") ? `${supplierName}'` : `${supplierName}'s`;
  return `Below ${owner} ${formatMoney(minimumCents)} minimum by ${formatMoney(gapCents)}.`;
}

/**
 * Up to 5 usual items to suggest: first those that close the gap on their own, smallest first, so the
 * buyer adds no more than needed; then the largest of the rest, which get closest.
 */
export function topUpOptions(candidates: TopUpOption[], gapCents: Cents): TopUpOption[] {
  const closes = candidates.filter((option) => option.totalCents >= gapCents).sort((a, b) => a.totalCents - b.totalCents);
  const rest = candidates.filter((option) => option.totalCents < gapCents).sort((a, b) => b.totalCents - a.totalCents);
  return [...closes, ...rest].slice(0, MAX_TOP_UPS);
}
