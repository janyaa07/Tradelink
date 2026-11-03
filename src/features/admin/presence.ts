export type Presence = "Online" | "Away" | "Offline";

const ONLINE_MS = 5 * 60_000;
const AWAY_MS = 30 * 60_000;

/** Online when seen in the last 5 minutes, Away within 30, otherwise Offline (ADM-16). */
export function presenceOf(lastSeenAt: string | null, now: Date): Presence {
  if (!lastSeenAt) return "Offline";
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return "Offline";
  const age = Math.max(0, now.getTime() - seen);
  if (age <= ONLINE_MS) return "Online";
  if (age <= AWAY_MS) return "Away";
  return "Offline";
}

export const PRESENCE_TONE = { Online: "good", Away: "warn", Offline: "plain" } as const satisfies Record<Presence, string>;
