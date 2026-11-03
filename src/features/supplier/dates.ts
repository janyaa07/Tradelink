const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const singaporeDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Singapore as "2026-11-03". */
export function todayInSingapore(now: Date): string {
  return singaporeDate.format(now);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Adds whole days to a calendar date such as "2026-11-03". */
export function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * The delivery date "Accept order" starts with (SUP-04): the buyer's requested date when it is
 * still today or later, otherwise tomorrow in Singapore.
 */
export function defaultDeliveryDate(requested: string | null, now: Date): string {
  const today = todayInSingapore(now);
  const asked = requested?.slice(0, 10) ?? null;
  if (asked && isIsoDate(asked) && asked >= today) return asked;
  return addDays(today, 1);
}

/** True when a delivery date is a real date on or after today in Singapore. */
export function isAllowedDeliveryDate(value: string, now: Date): boolean {
  return isIsoDate(value) && value >= todayInSingapore(now);
}
