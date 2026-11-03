import type { Cents } from "./money";
import { singaporeClockOf, singaporeDateOf, startOfWeekSingapore } from "./singapore-time";

/** The home pages' working-out: pace, pick list, customer pulse and a usual day (pure, Singapore time). */

const DAY_MS = 24 * 60 * 60 * 1000;

/** "this morning", "this afternoon" or "tonight", for the briefing line. */
export function partOfDay(now: Date): string {
  const hour = Math.floor(singaporeClockOf(now).minutes / 60);
  if (hour < 12) return "this morning";
  if (hour < 18) return "this afternoon";
  return "tonight";
}

/** Where the week's spend lands by Sunday at the pace so far. Half a day at least, so Monday morning is not wild. */
export function weekPace(spentCents: Cents, now: Date): Cents {
  const elapsedDays = Math.max(0.5, (now.getTime() - startOfWeekSingapore(now).getTime()) / DAY_MS);
  return Math.round((spentCents / elapsedDays) * 7);
}

export type PickOrder = {
  buyer: string;
  lines: { productId: string; name: string; unit: string; qty: number }[];
};

export type PickLine = {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  /** Who it is for, largest first. */
  buyers: { name: string; qty: number }[];
};

/** Everything to pack, added up across orders, so each shelf is picked once. Largest first. */
export function pickList(orders: PickOrder[]): PickLine[] {
  const lines = new Map<string, PickLine>();
  for (const order of orders) {
    for (const line of order.lines) {
      const entry = lines.get(line.productId) ?? { productId: line.productId, name: line.name, unit: line.unit, qty: 0, buyers: [] };
      entry.qty += line.qty;
      const buyer = entry.buyers.find((candidate) => candidate.name === order.buyer);
      if (buyer) buyer.qty += line.qty;
      else entry.buyers.push({ name: order.buyer, qty: line.qty });
      lines.set(line.productId, entry);
    }
  }
  return [...lines.values()]
    .map((line) => ({ ...line, buyers: [...line.buyers].sort((a, b) => b.qty - a.qty) }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}

export type PulseOrder = { buyer: string; createdAt: string };

export type Pulse = {
  buyer: string;
  kind: "quiet" | "growing" | "steady" | "new";
  /** Days since the last order, rounded down. */
  daysSince: number;
  /** The usual gap between orders in days, when there are enough orders to tell. */
  usualGap: number | null;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * How each buyer is ordering. Quiet: twice their usual gap (and at least 2 days) since the last
 * order. Growing: at least 30% more orders in the last 30 days than the 30 before. Quiet first.
 */
export function customerPulse(orders: PulseOrder[], now: Date): Pulse[] {
  const byBuyer = new Map<string, number[]>();
  for (const order of orders) {
    const list = byBuyer.get(order.buyer) ?? [];
    list.push(new Date(order.createdAt).getTime());
    byBuyer.set(order.buyer, list);
  }
  const rank = { quiet: 0, growing: 1, steady: 2, new: 3 };
  return [...byBuyer]
    .map(([buyer, times]): Pulse => {
      const sorted = [...times].sort((a, b) => a - b);
      const last = sorted[sorted.length - 1] ?? now.getTime();
      const daysSince = Math.floor((now.getTime() - last) / DAY_MS);
      const gaps = sorted.slice(1).map((time, index) => (time - (sorted[index] ?? time)) / DAY_MS);
      if (gaps.length < 2) return { buyer, kind: "new", daysSince, usualGap: null };
      const usualGap = Math.max(1, Math.round(median(gaps)));
      const recent = sorted.filter((time) => now.getTime() - time <= 30 * DAY_MS).length;
      const before = sorted.filter((time) => now.getTime() - time > 30 * DAY_MS && now.getTime() - time <= 60 * DAY_MS).length;
      if (daysSince >= Math.max(2, usualGap * 2)) return { buyer, kind: "quiet", daysSince, usualGap };
      if (before > 0 && recent >= 3 && recent >= before * 1.3) return { buyer, kind: "growing", daysSince, usualGap };
      return { buyer, kind: "steady", daysSince, usualGap };
    })
    .sort((a, b) => rank[a.kind] - rank[b.kind] || b.daysSince - a.daysSince);
}

export type DayOrder = { createdAt: string; totalCents: Cents };

export type UsualDay = {
  todayCount: number;
  todayCents: Cents;
  /** The average of the same weekday over the last four weeks, up to this time of day. Null with no history. */
  usualCount: number | null;
  usualCents: Cents | null;
};

/** Orders so far today against the same weekday, up to the same time, over the last four weeks. */
export function usualDay(orders: DayOrder[], now: Date): UsualDay {
  const today = singaporeDateOf(now);
  const minutesNow = singaporeClockOf(now).minutes;
  const todays = orders.filter((order) => singaporeDateOf(new Date(order.createdAt)) === today);
  const weeks = [1, 2, 3, 4].map((back) => singaporeDateOf(new Date(now.getTime() - back * 7 * DAY_MS)));
  const earlier = orders.filter((order) => {
    const at = new Date(order.createdAt);
    return weeks.includes(singaporeDateOf(at)) && singaporeClockOf(at).minutes <= minutesNow;
  });
  const oldest = orders.reduce((min, order) => Math.min(min, new Date(order.createdAt).getTime()), now.getTime());
  const weeksWithHistory = weeks.filter((date) => new Date(`${date}T23:59:59+08:00`).getTime() >= oldest).length;
  return {
    todayCount: todays.length,
    todayCents: todays.reduce((sum, order) => sum + order.totalCents, 0),
    usualCount: weeksWithHistory > 0 ? earlier.length / weeksWithHistory : null,
    usualCents: weeksWithHistory > 0 ? Math.round(earlier.reduce((sum, order) => sum + order.totalCents, 0) / weeksWithHistory) : null,
  };
}

/** Minutes until a "15:00" or "15:00:00" cut-off today, or null once it has passed. */
export function minutesToCutoff(cutoff: string, now: Date): number | null {
  const [hours = "16", minutes = "0"] = cutoff.split(":");
  const left = Number(hours) * 60 + Number(minutes) - singaporeClockOf(now).minutes;
  return left > 0 ? left : null;
}

/** "1h 52m", "45m". */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

const COUNTS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/**
 * The briefing line under the greeting. Subjects are short noun phrases for what needs the person,
 * most important first, such as "tomorrow's order".
 */
export function briefingLine(subjects: string[], now: Date): string {
  const when = partOfDay(now);
  const [first] = subjects;
  if (!first) return "Nothing needs you right now. Everything is on track.";
  if (subjects.length === 1) return `One thing needs you ${when}: ${first}. Everything else is on track.`;
  return `${COUNTS[subjects.length] ?? subjects.length} things need you ${when}, starting with ${first}.`;
}
