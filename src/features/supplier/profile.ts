/** Delivery days use ISO numbering, as in the database: 1 is Monday, 7 is Sunday. */
export const WEEKDAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 7, short: "Sun", label: "Sunday" },
] as const;

const shortName = (day: number) => WEEKDAYS.find((weekday) => weekday.value === day)?.short ?? "";

/** "Mon to Sat", "Mon, Wed, Fri" or "Mon to Wed, Fri". */
export function formatDeliveryDays(days: number[]): string {
  const sorted = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return "Not set";
  const runs: number[][] = [];
  for (const day of sorted) {
    const run = runs.at(-1);
    if (run && run.at(-1) === day - 1) run.push(day);
    else runs.push([day]);
  }
  return runs
    .flatMap((run) => {
      const first = run[0] ?? 0;
      const last = run.at(-1) ?? first;
      if (run.length >= 3) return [`${shortName(first)} to ${shortName(last)}`];
      return run.map(shortName);
    })
    .join(", ");
}

export function formatLeadTime(days: number): string {
  if (days === 0) return "Same day";
  return days === 1 ? "1 day" : `${days} days`;
}

/** "16:00:00" from the database becomes "16:00". */
export function formatCutoff(time: string): string {
  return time.slice(0, 5);
}

/** A 24-hour time such as "16:00" or "09:30". */
export function isCutoffTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
