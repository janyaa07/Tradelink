import { toCents, type Cents } from "./money";
import { singaporeDateOf, startOfWeekSingapore } from "./singapore-time";

/** The weekly spend chart shows four earlier weeks and this week (BUY-39). */
export const WEEKS_SHOWN = 5;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const NOT_SPEND = new Set(["rejected", "cancelled"]);

export type SpendLine = { qty: number; unitPrice: string };

export type SpendOrder = {
  status: string;
  supplierId: string;
  /** When the order was placed (ISO timestamp). */
  createdAt: string;
  lines: SpendLine[];
};

/** Rejected and cancelled orders are never spend. */
export function countsAsSpend(status: string): boolean {
  return !NOT_SPEND.has(status);
}

export function orderTotalCents(order: SpendOrder): Cents {
  return order.lines.reduce((sum, line) => sum + toCents(line.unitPrice) * line.qty, 0);
}

/** Monday 00:00 in Singapore for each shown week, oldest first; the last one is this week. */
export function weekStarts(now: Date, count: number = WEEKS_SHOWN): Date[] {
  const thisWeek = startOfWeekSingapore(now).getTime();
  return Array.from({ length: count }, (_, index) => new Date(thisWeek - (count - 1 - index) * WEEK_MS));
}

export type WeekSpend = {
  /** Monday of the week as a Singapore calendar date, "2026-10-27". */
  startDate: string;
  isThisWeek: boolean;
  cents: Cents;
};

/** Spend per week, Monday to Sunday in Singapore, by when each order was placed. */
export function weeklySpend(orders: SpendOrder[], now: Date, count: number = WEEKS_SHOWN): WeekSpend[] {
  const starts = weekStarts(now, count);
  const totals = starts.map(() => 0);
  const first = starts[0]?.getTime() ?? 0;
  for (const order of orders) {
    if (!countsAsSpend(order.status)) continue;
    const index = Math.floor((new Date(order.createdAt).getTime() - first) / WEEK_MS);
    if (index < 0 || index >= count) continue;
    totals[index] = (totals[index] ?? 0) + orderTotalCents(order);
  }
  return starts.map((start, index) => ({
    startDate: singaporeDateOf(start),
    isThisWeek: index === count - 1,
    cents: totals[index] ?? 0,
  }));
}

export type SupplierSpend = { supplierId: string; cents: Cents };

/** Spend per supplier, largest first; suppliers with no spend are left out. */
export function spendBySupplier(orders: SpendOrder[]): SupplierSpend[] {
  const totals = new Map<string, Cents>();
  for (const order of orders) {
    if (!countsAsSpend(order.status)) continue;
    totals.set(order.supplierId, (totals.get(order.supplierId) ?? 0) + orderTotalCents(order));
  }
  return [...totals]
    .filter(([, cents]) => cents > 0)
    .map(([supplierId, cents]) => ({ supplierId, cents }))
    .sort((a, b) => b.cents - a.cents || a.supplierId.localeCompare(b.supplierId));
}

export type Delivery = {
  /** When it was delivered (ISO timestamp), or null if not delivered. */
  deliveredAt: string | null;
  /** The delivery date the supplier confirmed, "2026-11-04". */
  confirmedDate: string | null;
};

/**
 * Percentage of delivered orders that arrived on or before the confirmed date, by Singapore
 * calendar date, rounded to a whole number. Null when there are no deliveries to judge.
 * Deliveries without a confirmed date cannot be judged and are left out.
 */
export function onTimePercent(deliveries: Delivery[]): number | null {
  let judged = 0;
  let onTime = 0;
  for (const delivery of deliveries) {
    if (!delivery.deliveredAt || !delivery.confirmedDate) continue;
    judged += 1;
    if (singaporeDateOf(new Date(delivery.deliveredAt)) <= delivery.confirmedDate.slice(0, 10)) onTime += 1;
  }
  return judged === 0 ? null : Math.round((onTime / judged) * 100);
}

const CAUGHT = new Set(["credit_promised", "credit_received"]);

export type IssueAmount = { status: string; amount: string };

/** Overcharges caught: credits promised or received on the buyer's problems. */
export function overchargesCaughtCents(issues: IssueAmount[]): Cents {
  return issues.reduce((sum, issue) => (CAUGHT.has(issue.status) ? sum + toCents(issue.amount) : sum), 0);
}

/** What is left of the weekly budget, never below zero, and whether it is overspent. */
export function budgetLeft(budget: Cents, spent: Cents): { left: Cents; over: boolean } {
  return { left: Math.max(0, budget - spent), over: spent > budget };
}
