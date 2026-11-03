import { daysLeft, formatDaysLeft } from "@/domain/reorder";

export type DaysTone = "good" | "warn" | "bad" | "plain";

/** Under 1 day is bad, under 3 is a warning, otherwise good. No use per day means no estimate. */
export function daysTone(days: number): DaysTone {
  if (!Number.isFinite(days)) return "plain";
  if (days < 1) return "bad";
  if (days < 3) return "warn";
  return "good";
}

/** The pill text: "2.5 days left", or "No daily use" when there is nothing to estimate from. */
export function daysLabel(days: number): string {
  return Number.isFinite(days) ? `${formatDaysLeft(days)} days left` : "No daily use";
}

/** Days left from the values being edited, so the pill follows the fields before they are saved. */
export function liveDaysLeft(inShop: string, usePerDay: string, onOrder: number): number | null {
  const shop = Number(inShop);
  const use = Number(usePerDay);
  if (inShop.trim() === "" || usePerDay.trim() === "" || !Number.isFinite(shop) || !Number.isFinite(use)) return null;
  return daysLeft(shop, onOrder, use);
}
