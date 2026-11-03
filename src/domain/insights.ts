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

/** A status level for colour coding. The UI always pairs it with a word. */
export type Level = "good" | "warn" | "bad";

export type Direction = "up" | "down" | "same";

export function changeDirection(from: Cents, to: Cents): Direction {
  if (to > from) return "up";
  if (to < from) return "down";
  return "same";
}

/**
 * Percentage change from one amount to another, rounded to one decimal place and never negative
 * (read it with `changeDirection`). Null when there is nothing to compare against.
 */
export function percentChange(from: Cents, to: Cents): number | null {
  if (from <= 0) return null;
  return Math.round((Math.abs(to - from) / from) * 1000) / 10;
}

/** The budget card: good below 75% used, warn from 75% up to the budget, bad over it. */
export const BUDGET_WARN_FROM = 75;

/** How much of the weekly budget is used, as a whole percent, and its level. Null without a budget. */
export function budgetUse(budget: Cents, spent: Cents): { percent: number; level: Level } | null {
  if (budget <= 0) return null;
  const level: Level = spent > budget ? "bad" : spent * 100 >= budget * BUDGET_WARN_FROM ? "warn" : "good";
  return { percent: Math.round((spent / budget) * 100), level };
}

/** The supplier record pill: good at 95% or more on time, warn from 85%, bad below. */
export function onTimeLevel(percent: number | null): Level | null {
  if (percent === null) return null;
  if (percent >= 95) return "good";
  if (percent >= 85) return "warn";
  return "bad";
}

export type PriceMove = { oldPrice: string; newPrice: string };

/** How many price changes went up and how many went down. */
export function priceChangeSplit(changes: PriceMove[]): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const change of changes) {
    const direction = changeDirection(toCents(change.oldPrice), toCents(change.newPrice));
    if (direction === "up") up += 1;
    else if (direction === "down") down += 1;
  }
  return { up, down };
}

/** Whole percentages of the total that always add up to 100 (largest remainder). All zero when the total is zero. */
export function sharePercents(values: Cents[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const shares = exact.map(Math.floor);
  let left = 100 - shares.reduce((sum, share) => sum + share, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    shares[index] = (shares[index] ?? 0) + 1;
    left -= 1;
  }
  return shares;
}

/** The categorical chart palette has eight colours; more suppliers than that fold into "Other". */
export const SUPPLIER_SLICES = 8;

export type SpendSlice = {
  /** Null for "Other", the suppliers folded together. */
  supplierId: string | null;
  cents: Cents;
  /** Whole percent of the total; the slices add up to 100. */
  percent: number;
  /** Categorical colour slot from 0, or null for "Other". */
  slot: number | null;
};

/**
 * Spend by supplier as chart slices, largest first. Past `maxSlices` the smallest fold into "Other".
 * Colours follow the supplier, not its rank: slots go by `stableOrder` (such as suppliers by name),
 * so a supplier keeps its colour when the ranking changes.
 */
export function supplierSlices(
  rows: SupplierSpend[],
  stableOrder: string[],
  maxSlices: number = SUPPLIER_SLICES,
): SpendSlice[] {
  const sorted = [...rows].sort((a, b) => b.cents - a.cents || a.supplierId.localeCompare(b.supplierId));
  const kept = sorted.length > maxSlices ? sorted.slice(0, maxSlices - 1) : sorted;
  const otherCents = sorted.slice(kept.length).reduce((sum, row) => sum + row.cents, 0);

  const position = new Map(stableOrder.map((id, index) => [id, index]));
  const slots = new Map(
    [...kept]
      .sort(
        (a, b) =>
          (position.get(a.supplierId) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.supplierId) ?? Number.MAX_SAFE_INTEGER) ||
          a.supplierId.localeCompare(b.supplierId),
      )
      .map((row, index) => [row.supplierId, index]),
  );

  const amounts = otherCents > 0 ? [...kept.map((row) => row.cents), otherCents] : kept.map((row) => row.cents);
  const percents = sharePercents(amounts);
  const slices: SpendSlice[] = kept.map((row, index) => ({
    supplierId: row.supplierId,
    cents: row.cents,
    percent: percents[index] ?? 0,
    slot: slots.get(row.supplierId) ?? null,
  }));
  if (otherCents > 0) slices.push({ supplierId: null, cents: otherCents, percent: percents[kept.length] ?? 0, slot: null });
  return slices;
}
