/** Singapore is UTC+8 all year (no daylight saving), so a fixed offset is exact. */
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type SingaporeClock = {
  /** ISO weekday: 1 = Monday to 7 = Sunday. */
  isoWeekday: number;
  /** Minutes since midnight in Singapore. */
  minutes: number;
};

export function singaporeClockOf(now: Date): SingaporeClock {
  const local = new Date(now.getTime() + OFFSET_MS);
  return {
    isoWeekday: ((local.getUTCDay() + 6) % 7) + 1,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** Calendar date in Singapore, "2026-11-03". */
export function singaporeDateOf(now: Date): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant Monday 00:00 began in Singapore for the week containing `now`. */
export function startOfWeekSingapore(now: Date): Date {
  const local = new Date(now.getTime() + OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - daysSinceMonday * DAY_MS - OFFSET_MS);
}

/** Weekday name for an ISO weekday number (1 to 7). */
export function weekdayName(isoWeekday: number): string {
  return WEEKDAY_NAMES[(((isoWeekday - 1) % 7) + 7) % 7] ?? "Monday";
}
