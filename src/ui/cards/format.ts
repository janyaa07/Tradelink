const clock = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

/** "4:12pm" in Singapore time. */
export function formatClock(iso: string): string {
  const parts = clock.formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = value("hour") === "0" ? "12" : value("hour");
  return `${hour}:${value("minute")}${value("dayPeriod").toLowerCase().replaceAll(".", "").replaceAll(" ", "")}`;
}

/** "4:05" for minutes and seconds left, never below zero. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
