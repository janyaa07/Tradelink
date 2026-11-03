import { plural, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, lineTotal, type Cents } from "@/domain/money";
import { findSubstitute } from "@/domain/reader/substitute";
import { isPriceAboveLastPaid } from "@/domain/review";
import type { PillTone } from "@/ui/Pill";
import type { DraftLine } from "./draft";

type Attention = { label: "Check this" | "Not in catalogue"; tone: PillTone };

const CHECK_THIS: Attention = { label: "Check this", tone: "warn" };
const NOT_IN_CATALOGUE: Attention = { label: "Not in catalogue", tone: "bad" };

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
  /** The match pill, shown only when the line needs the buyer: "Check this" or "Not in catalogue". */
  attention: Attention | null;
  border: "plain" | "warn" | "bad";
  over: boolean;
  /** Shown instead of notes when the line has no product or asks for more than is available. */
  message: string | null;
  /** "S$12.40 per bag". */
  unitPrice: string | null;
  totalCents: Cents | null;
  /** The product is still unconfirmed, so its price is an estimate. */
  estimated: boolean;
  notes: string[];
  /** "You last paid S$x" when the price is more than 2% above it (BUY-17). */
  lastPaidNote: string | null;
  substitute: CatalogueItem | null;
  canAddToCatalogue: boolean;
};

function unitWord(unit: string): string {
  return plural(2, unit).replace(/^2 /, "");
}

function notesFor(line: DraftLine, item: CatalogueItem, invited: boolean): string[] {
  const notes: string[] = [];
  if (item.status === "unconfirmed") notes.push("Stock to be confirmed");
  if (invited) notes.push("Waits for the supplier to accept your invitation");
  if (line.kg !== null && item.packKg) notes.push(`${line.kg}kg rounded to full ${unitWord(item.unit)}`);
  if (line.qtyAssumed) notes.push("Quantity assumed");
  return notes;
}

/** Everything a cart line shows, from its state, product and stock (BUY-14 to BUY-17). */
export function lineView(line: DraftLine, context: LineContext): LineView {
  const item = line.productId ? (context.byId.get(line.productId) ?? null) : null;
  if (!item) {
    const check = line.state === "check";
    return {
      item: null,
      attention: check ? CHECK_THIS : NOT_IN_CATALOGUE,
      border: check ? "warn" : "bad",
      over: false,
      message: check
        ? "More than one product fits. Choose the right one."
        : "No match found. Add it to the catalogue, choose a product, or remove this line.",
      unitPrice: null,
      totalCents: null,
      estimated: false,
      notes: [],
      lastPaidNote: null,
      substitute: null,
      canAddToCatalogue: line.state === "not_found",
    };
  }
  const over = context.over.has(item.id);
  const lastPaid = context.lastPaid.get(item.id) ?? null;
  return {
    item,
    attention: line.state === "check" ? CHECK_THIS : null,
    border: over ? "bad" : line.state === "check" ? "warn" : "plain",
    over,
    message: over ? `Only ${Math.max(0, item.available)} available. Reduce the quantity.` : null,
    unitPrice: `${formatMoney(item.price)} per ${item.unit}`,
    totalCents: lineTotal(item.price, line.qty),
    estimated: item.status === "unconfirmed",
    notes: over ? [] : notesFor(line, item, context.invitedSuppliers.has(item.supplierOrgId)),
    lastPaidNote: !over && lastPaid && isPriceAboveLastPaid(item.price, lastPaid) ? `You last paid ${formatMoney(lastPaid)}` : null,
    substitute: over ? findSubstitute(item, line.qty, context.catalogue) : null,
    canAddToCatalogue: false,
  };
}
