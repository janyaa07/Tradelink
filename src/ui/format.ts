const TIME_ZONE = "Asia/Singapore";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const singaporeParts = new Intl.DateTimeFormat("en-SG", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function partsInSingapore(date: Date): Parts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of singaporeParts.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "3 Nov, 14:05" in Singapore time. */
export function formatDateTime(iso: string): string {
  const { month, day, hour, minute } = partsInSingapore(new Date(iso));
  return `${day} ${MONTHS[month - 1]}, ${pad(hour)}:${pad(minute)}`;
}

/** "Tue 4 Nov" for a calendar date such as "2026-11-04". */
export function formatDate(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.slice(0, 10).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

export function greeting(now: Date): string {
  const { hour } = partsInSingapore(now);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function orderNumber(n: number): string {
  return `ORD-${n}`;
}

export function issueNumber(n: number): string {
  return `ISS-${n}`;
}

const longDate = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

/** "Wednesday 4 November" in Singapore time, for the home greeting. */
export function formatLongDate(now: Date): string {
  return longDate.format(now).replace(",", "");
}
