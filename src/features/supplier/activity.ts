import { formatDate } from "@/ui/format";
import { addDays, todayInSingapore } from "./dates";

export const ACTIVITY_FILTERS = ["all", "order", "stock", "account"] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];
export type ActivityKind = Exclude<ActivityFilter, "all">;

export const ACTIVITY_FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "All",
  order: "Orders",
  stock: "Stock",
  account: "Account",
};

export function parseActivityFilter(value: string): ActivityFilter {
  return ACTIVITY_FILTERS.find((filter) => filter === value) ?? "all";
}

export function activityHref(filter: ActivityFilter): string {
  return filter === "all" ? "/supplier/activity" : `/supplier/activity?filter=${filter}`;
}

const STOCK_ACTION = /^(Received|Adjusted|Changed price|Added (?!supplier)|Confirmed (?!all items))/;

/** What an audit entry is about, from its wording: anything naming an order, a stock or price change, or the account. */
export function activityKind(action: string): ActivityKind {
  if (/\bORD-\d+/.test(action)) return "order";
  if (STOCK_ACTION.test(action)) return "stock";
  return "account";
}

export type ActivityTone = "good" | "warn" | "bad" | "info" | "plain";

/** Rejections, cancellations and reported problems stand out; blocked attempts most of all. */
export function activityTone(item: { action: string; denied: boolean }): ActivityTone {
  if (item.denied) return "bad";
  if (/^(Rejected|Cancelled|Reported)/.test(item.action)) return "warn";
  const kind = activityKind(item.action);
  if (kind === "order") return "good";
  if (kind === "stock") return "info";
  return "plain";
}

export type ActivityDay<T> = { key: string; label: string; items: T[] };

/** Entries grouped by Singapore calendar day, keeping their order: Today, Yesterday, then "Mon 2 Nov". */
export function groupByDay<T extends { at: string }>(items: T[], now: Date): ActivityDay<T>[] {
  const today = todayInSingapore(now);
  const yesterday = addDays(today, -1);
  const days: ActivityDay<T>[] = [];
  for (const item of items) {
    const key = todayInSingapore(new Date(item.at));
    const last = days.at(-1);
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    const label = key === today ? "Today" : key === yesterday ? "Yesterday" : formatDate(key);
    days.push({ key, label, items: [item] });
  }
  return days;
}

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "14:05" in Singapore time. */
export function timeOfDay(iso: string): string {
  return clock.format(new Date(iso));
}
