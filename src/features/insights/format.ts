import type { Level, WeekSpend } from "@/domain/insights";
import type { Cents } from "@/domain/money";
import type { PillTone } from "@/ui/Pill";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(isoDate: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "27 Oct" for "2026-10-27". */
export function dayMonth(isoDate: string): string {
  const date = parseDate(isoDate);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "5 Oct to 8 Nov 2026": Monday of the first week to Sunday of the last. */
export function periodLabel(weeks: WeekSpend[]): string {
  const first = weeks[0];
  const last = weeks.at(-1);
  if (!first || !last) return "";
  const end = new Date(parseDate(last.startDate).getTime() + 6 * DAY_MS);
  return `${dayMonth(first.startDate)} to ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** Whole Singapore dollars for chart labels, "S$1,235". */
export function formatWholeMoney(cents: Cents): string {
  return `S$${Math.round(cents / 100).toLocaleString("en-SG")}`;
}

/** "12%" from 10 up, "4.5%" below. */
export function formatPercent(percent: number): string {
  return percent >= 10 ? `${Math.round(percent)}%` : `${Number(percent.toFixed(1))}%`;
}

export const LEVEL_TONE: Record<Level, PillTone> = { good: "good", warn: "warn", bad: "bad" };

export const LEVEL_TEXT: Record<Level, string> = { good: "text-good", warn: "text-warn", bad: "text-bad" };

export const LEVEL_FILL: Record<Level, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" };
