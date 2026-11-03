import { sumCents, type Cents } from "@/domain/money";
import type { OrderState, OrderSummaryData, OrderSummaryGroup, OrderSummaryLine } from "./schema";

/**
 * Order summary math, shared by the server (hydration) and the card (totals while the owner edits).
 * Pure: no database and no clock.
 */

export type BillingType = "fixed" | "per_kg" | "market";

export type SummaryLineInput = {
  lineId: string;
  position: number;
  rawText: string;
  qty: number | null;
  status: string;
  /** shop_order_line.expected_price_cents, set from expected_price when the item was picked or pinned. */
  priceCents: Cents | null;
  deliveryDate: string | null;
  item: { name: string; orderUnit: string; billingType: BillingType; supplierId: string | null } | null;
};

export type SupplierTerms = {
  supplierId: string;
  name: string;
  minimumOrderCents: Cents | null;
  paymentTerms: string | null;
};

export type SummaryInput = {
  orderId: string;
  orderState: OrderState;
  createdAt: string;
  lines: SummaryLineInput[];
  suppliers: SupplierTerms[];
  purchaseOrders: { supplierId: string; number: number }[];
};

export const NOT_READY_GROUP = "Needs your pick";
const UNKNOWN_SUPPLIER = "Supplier";

const PAYMENT_NOTES: Record<string, string> = {
  cod: "Cash on delivery",
  "7d": "Pay within 7 days",
  "14d": "Pay within 14 days",
  "30d": "Pay within 30 days",
};

export function paymentNote(terms: string | null): string | null {
  return terms ? (PAYMENT_NOTES[terms] ?? null) : null;
}

/** "Seng Choon Eggs Fresh tray of 30", the same words a purchase order line uses. */
export function itemName(product: { brand: string | null; name: string; variant: string | null; pack_size: string | null }): string {
  return [product.brand, product.name, product.variant, product.pack_size].filter((part) => part && part.trim()).join(" ");
}

function lineTotal(unitPriceCents: Cents | null, qty: number | null): Cents | null {
  return unitPriceCents === null || qty === null ? null : unitPriceCents * qty;
}

/** Recomputes a group's subtotal and flags from its lines. Lines with no known price are left out. */
export function totalGroup(group: OrderSummaryGroup): OrderSummaryGroup {
  const lines = group.lines.map((line) => ({ ...line, lineTotalCents: lineTotal(line.unitPriceCents, line.qty) }));
  const subtotalCents = sumCents(lines.map((line) => line.lineTotalCents ?? 0));
  return {
    ...group,
    lines,
    subtotalCents,
    approx: lines.some((line) => line.approx),
    unknownPriceCount: lines.filter((line) => !line.needsPick && line.lineTotalCents === null).length,
    belowMinimum: group.supplierId !== null && group.minimumOrderCents !== null && subtotalCents < group.minimumOrderCents,
  };
}

export function totalOrder(data: OrderSummaryData): OrderSummaryData {
  const groups = data.groups.map(totalGroup);
  return {
    ...data,
    groups,
    totalCents: sumCents(groups.map((group) => group.subtotalCents)),
    approx: groups.some((group) => group.approx),
    unknownPriceCount: groups.reduce((count, group) => count + group.unknownPriceCount, 0),
    needsPickCount: groups.reduce((count, group) => count + group.lines.filter((line) => line.needsPick).length, 0),
  };
}

/** Groups the order's lines by supplier with subtotals, the grand total and the warnings. */
export function summarizeOrder(input: SummaryInput): OrderSummaryData {
  const terms = new Map(input.suppliers.map((supplier) => [supplier.supplierId, supplier]));
  const poNumbers = new Map(input.purchaseOrders.map((po) => [po.supplierId, po.number]));
  const groups = new Map<string | null, OrderSummaryGroup>();
  let skippedCount = 0;

  for (const line of [...input.lines].sort((a, b) => a.position - b.position)) {
    if (line.status === "SKIPPED") {
      skippedCount += 1;
      continue;
    }
    const needsPick = line.item === null || line.qty === null;
    const supplierId = needsPick ? null : (line.item?.supplierId ?? null);
    const view: OrderSummaryLine = {
      lineId: line.lineId,
      itemName: line.item?.name || line.rawText.trim() || "Item",
      needsPick,
      qty: line.qty,
      orderUnit: line.item?.orderUnit ?? null,
      unitPriceCents: line.item ? line.priceCents : null,
      lineTotalCents: null,
      approx: line.item !== null && line.item.billingType !== "fixed",
    };
    const group = groups.get(supplierId);
    if (group) {
      group.lines.push(view);
      if (line.deliveryDate && (!group.deliveryDate || line.deliveryDate < group.deliveryDate)) group.deliveryDate = line.deliveryDate;
      continue;
    }
    const supplier = supplierId ? terms.get(supplierId) : undefined;
    groups.set(supplierId, {
      supplierId,
      supplierName: supplierId ? (supplier?.name ?? UNKNOWN_SUPPLIER) : NOT_READY_GROUP,
      deliveryDate: line.deliveryDate,
      paymentNote: paymentNote(supplier?.paymentTerms ?? null),
      minimumOrderCents: supplier?.minimumOrderCents ?? null,
      belowMinimum: false,
      subtotalCents: 0,
      approx: false,
      unknownPriceCount: 0,
      purchaseOrderNumber: supplierId ? (poNumbers.get(supplierId) ?? null) : null,
      lines: [view],
    });
  }

  const ordered = [...groups.values()].sort((a, b) => {
    if (a.supplierId === null) return 1;
    if (b.supplierId === null) return -1;
    return a.supplierName.localeCompare(b.supplierName);
  });

  return totalOrder({
    orderId: input.orderId,
    orderState: input.orderState,
    createdAt: input.createdAt,
    groups: ordered,
    skippedCount,
    needsPickCount: 0,
    unknownPriceCount: 0,
    approx: false,
    totalCents: 0,
  });
}

/** The summary with the owner's unsaved quantities, for live totals and minimum-order warnings. */
export function withQuantities(data: OrderSummaryData, quantities: ReadonlyMap<string, number>): OrderSummaryData {
  return totalOrder({
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      lines: group.lines.map((line) => {
        const qty = quantities.get(line.lineId);
        return qty === undefined || line.needsPick ? line : { ...line, qty };
      }),
    })),
  });
}
