import { z } from "zod";
import { UNITS, type CatalogueItem, type Unit } from "./catalogue";
import { toCents, type Cents } from "./money";

/** Ordering rules for the review step (DISCOVERY 6.2). */
export const MAX_LINE_QTY = 9999;

export type QuantityLine = { productId: string | null; qty: number };

export type LinesCheck = {
  /** Lines with no product, or a product no longer in the catalogue. */
  unresolved: number;
  /** Total quantity per product across lines. */
  need: Map<string, number>;
  /** Confirmed products asked for beyond what is available. */
  over: string[];
};

export function checkLines(lines: QuantityLine[], catalogue: Map<string, CatalogueItem>): LinesCheck {
  const need = new Map<string, number>();
  let unresolved = 0;
  for (const line of lines) {
    if (!line.productId || !catalogue.has(line.productId)) {
      unresolved += 1;
      continue;
    }
    need.set(line.productId, (need.get(line.productId) ?? 0) + line.qty);
  }
  const over = [...need].filter(([id, qty]) => {
    const item = catalogue.get(id);
    return item !== undefined && item.status === "active" && qty > item.available;
  });
  return { unresolved, need, over: over.map(([id]) => id) };
}

export type SupplierSubtotal = { supplierOrgId: string; supplierName: string; totalCents: Cents };

/** One subtotal per supplier, which is how the review splits into orders. */
export function subtotalsBySupplier(need: Map<string, number>, catalogue: Map<string, CatalogueItem>): SupplierSubtotal[] {
  const groups = new Map<string, SupplierSubtotal>();
  for (const [id, qty] of need) {
    const item = catalogue.get(id);
    if (!item) continue;
    const group = groups.get(item.supplierOrgId) ?? {
      supplierOrgId: item.supplierOrgId,
      supplierName: item.supplierName,
      totalCents: 0,
    };
    group.totalCents += toCents(item.price) * qty;
    groups.set(item.supplierOrgId, group);
  }
  return [...groups.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

/** True when the price is more than 2% above what the buyer last paid (BUY-17). */
export function isPriceAboveLastPaid(price: string, lastPaid: string | null): boolean {
  if (lastPaid === null) return false;
  return toCents(price) * 100 > toCents(lastPaid) * 102;
}

/** Whole numbers from 1 to 9999; anything else becomes 1 (BUY-15). */
export function wholeQuantity(value: string | number): number {
  const number = typeof value === "number" ? value : Number(value.trim() === "" ? Number.NaN : value);
  if (!Number.isInteger(number) || number < 1) return 1;
  return Math.min(number, MAX_LINE_QTY);
}

export function isOverBudget(weekSpentCents: Cents, orderCents: Cents, budgetCents: Cents): boolean {
  return weekSpentCents + orderCents > budgetCents;
}

/** Adds incoming lines to existing ones; a product already in the order gets the extra quantity. */
export function mergeLines<T extends QuantityLine>(existing: T[], incoming: T[]): T[] {
  const next = [...existing];
  for (const line of incoming) {
    const index = line.productId ? next.findIndex((other) => other.productId === line.productId) : -1;
    const current = index >= 0 ? next[index] : undefined;
    if (current) next[index] = { ...current, qty: Math.min(MAX_LINE_QTY, current.qty + line.qty) };
    else next.push(line);
  }
  return next;
}

const stockShortSchema = z.array(z.object({ productId: z.uuid(), available: z.number().int() }));

/** Reads the STOCK_SHORT detail from place_orders: [{"productId":"…","available":3}]. */
export function parseStockShort(detail: string | undefined): Map<string, number> {
  if (!detail) return new Map();
  try {
    const parsed = stockShortSchema.safeParse(JSON.parse(detail));
    return parsed.success ? new Map(parsed.data.map((row) => [row.productId, Math.max(0, row.available)])) : new Map();
  } catch {
    return new Map();
  }
}

const UNIT_ALIASES: Record<string, Unit> = { ctn: "carton", btl: "bottle", pkt: "packet", kg: "bag", boxe: "box" };
const QUANTITY_WITH_UNIT =
  /\b\d+(?:\.\d+)?\s*(?:x\b|ctns?\b|cartons?\b|box(?:es)?\b|bags?\b|btls?\b|bottles?\b|tins?\b|cans?\b|pkts?\b|packets?\b|packs?\b|tubs?\b|trays?\b|kgs?\b)?/gi;
const FILLER = /\b(?:pls|please|need|want|of|for|tomorrow|today|thanks|the|some)\b/gi;

/** The pack word a buyer typed, as a Tradelink unit; "pack" when none is given. */
export function guessUnit(sourceText: string): Unit {
  const match = /\d+(?:\.\d+)?\s*([a-z]+)/i.exec(sourceText);
  const word = (match?.[1] ?? "").toLowerCase().replace(/s$/, "");
  const unit = UNIT_ALIASES[word] ?? word;
  return (UNITS as readonly string[]).includes(unit) ? (unit as Unit) : "pack";
}

/** A product name suggested from a typed line: quantities, units and filler removed, first letter capitalised. */
export function guessProductName(sourceText: string): string {
  const name = sourceText
    .replace(/^[-*\s]+/, "")
    .replace(QUANTITY_WITH_UNIT, " ")
    .replace(FILLER, " ")
    .replace(/[.!:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
