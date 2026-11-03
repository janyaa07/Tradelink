import { plural, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, lineTotal } from "@/domain/money";
import { findSubstitute } from "@/domain/reader/substitute";
import { isPriceAboveLastPaid } from "@/domain/review";
import type { PillTone } from "@/ui/Pill";
import type { DraftLine, DraftState } from "./draft";

const PILLS: Record<DraftState, { label: string; tone: PillTone }> = {
  matched: { label: "Matched", tone: "good" },
  check: { label: "Check this", tone: "warn" },
  not_found: { label: "Not in catalogue", tone: "bad" },
  added: { label: "Added to catalogue", tone: "info" },
  suggested: { label: "Suggested", tone: "info" },
  manual: { label: "Added by you", tone: "info" },
};

export type LineContext = {
  /** The buyer's catalogue, with availability lowered where a stock check found less. */
  byId: Map<string, CatalogueItem>;
  catalogue: CatalogueItem[];
  /** Products asked for beyond what is available. */
  over: Set<string>;
  invitedSuppliers: Set<string>;
  lastPaid: Map<string, string | null>;
};

export type LineView = {
  item: CatalogueItem | null;
  pill: { label: string; tone: PillTone };
  border: "plain" | "warn" | "bad";
  over: boolean;
  /** Shown instead of details when the line has no product. */
  message: string | null;
  details: string[];
  /** "you last paid S$x" when the price is more than 2% above it (BUY-17). */
  lastPaidNote: string | null;
  substitute: CatalogueItem | null;
  canAddToCatalogue: boolean;
};

function unitWord(unit: string): string {
  return plural(2, unit).replace(/^2 /, "");
}

function detailsFor(line: DraftLine, item: CatalogueItem, invited: boolean): string[] {
  const details = [`${plural(line.qty, item.unit)}`, formatMoney(lineTotal(item.price, line.qty))];
  if (item.status === "unconfirmed") details[1] = `${details[1]} estimated`;
  details.push(item.status === "unconfirmed" ? "stock to be confirmed" : `${Math.max(0, item.available)} available`);
  details.push(item.supplierName);
  if (invited) details.push("waits for supplier to accept invitation");
  if (line.kg !== null && item.packKg) details.push(`${line.kg}kg rounded to full ${unitWord(item.unit)}`);
  if (line.qtyAssumed) details.push("quantity assumed");
  return details;
}

/** Everything a review line shows, from its state, product and stock (BUY-14 to BUY-17). */
export function lineView(line: DraftLine, context: LineContext): LineView {
  const item = line.productId ? (context.byId.get(line.productId) ?? null) : null;
  const pill = PILLS[line.state];
  if (!item) {
    const check = line.state === "check";
    return {
      item: null,
      pill,
      border: check ? "warn" : "bad",
      over: false,
      message: check
        ? "More than one product fits. Choose the right one."
        : "No match found. Add it to the catalogue, choose a product, or remove this line.",
      details: [],
      lastPaidNote: null,
      substitute: null,
      canAddToCatalogue: line.state === "not_found",
    };
  }
  const over = context.over.has(item.id);
  const lastPaid = context.lastPaid.get(item.id) ?? null;
  return {
    item,
    pill,
    border: over ? "bad" : "plain",
    over,
    message: over ? `Only ${Math.max(0, item.available)} available. Reduce the quantity.` : null,
    details: over ? [] : detailsFor(line, item, context.invitedSuppliers.has(item.supplierOrgId)),
    lastPaidNote: !over && lastPaid && isPriceAboveLastPaid(item.price, lastPaid) ? `you last paid ${formatMoney(lastPaid)}` : null,
    substitute: over ? findSubstitute(item, line.qty, context.catalogue) : null,
    canAddToCatalogue: false,
  };
}
