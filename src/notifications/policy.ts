/**
 * When a push goes out (docs/AI_DESIGN.md section 6). Pure: the caller loads the counts and settings.
 * The in-app notification is always written; this only decides the push.
 *
 * - urgent (cut-off at risk, delivery problem, bank detail change): always now, if there is a device.
 * - prompted (a reply to something the person just did): now, unless the type is muted or off.
 * - unprompted: skipped when off, muted, ignored 3 times in a row (which mutes it), already pushed for
 *   the same item today, or over the daily limit (the alert waits in the inbox for the next brief);
 *   held until quiet hours end; otherwise now.
 */
export type PromptKind = "prompted" | "unprompted" | "urgent";

export type QuietHours = {
  /** Singapore wall-clock time, "22:00" or "22:00:00". */
  start: string;
  end: string;
};

export type PolicyInput = {
  promptKind: PromptKind;
  type: string;
  now: Date;
  /** The shop's quiet hours, or null when the person has no shop (they then have none). */
  quietHours: QuietHours | null;
  /** Unprompted pushes already sent to this person today (Singapore day). */
  unpromptedToday: number;
  dailyLimit: number;
  mutedTypes: readonly string[];
  pushOffTypes: readonly string[];
  hasPushDevice: boolean;
  /** This type's most recent pushes in a row that were neither opened nor acted on. */
  ignoredStreak: number;
  /** A push about the same item already went (or is held) today. */
  sameItemToday: boolean;
};

export type DecisionReason =
  | "urgent"
  | "prompted"
  | "within_limit"
  | "quiet_hours"
  | "no_device"
  | "push_off"
  | "muted"
  | "ignored"
  | "merged"
  | "daily_limit";

export type Decision =
  | { push: "now"; reason: DecisionReason }
  | { push: "hold"; releaseAt: Date; reason: "quiet_hours" }
  | { push: "skip"; reason: DecisionReason; muteType?: true };

/** Ignored this many times in a row, an unprompted type is muted for that person. */
export const MUTE_AFTER_IGNORED = 3;

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function decide(input: PolicyInput): Decision {
  if (!input.hasPushDevice) return { push: "skip", reason: "no_device" };
  if (input.promptKind === "urgent") return { push: "now", reason: "urgent" };
  if (input.pushOffTypes.includes(input.type)) return { push: "skip", reason: "push_off" };
  if (input.mutedTypes.includes(input.type)) return { push: "skip", reason: "muted" };
  if (input.promptKind === "prompted") return { push: "now", reason: "prompted" };

  if (input.ignoredStreak >= MUTE_AFTER_IGNORED) return { push: "skip", reason: "ignored", muteType: true };
  if (input.sameItemToday) return { push: "skip", reason: "merged" };
  if (input.unpromptedToday >= input.dailyLimit) return { push: "skip", reason: "daily_limit" };

  const releaseAt = input.quietHours ? quietHoursEnd(input.now, input.quietHours) : null;
  if (releaseAt) return { push: "hold", releaseAt, reason: "quiet_hours" };
  return { push: "now", reason: "within_limit" };
}

/** Minutes since midnight for "HH:MM" or "HH:MM:SS", or null when malformed. */
export function minutesOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * When quiet hours end, if `now` is inside them; otherwise null. Windows may cross midnight
 * (22:00 to 06:00). Equal or malformed times mean no quiet hours.
 */
export function quietHoursEnd(now: Date, quiet: QuietHours): Date | null {
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === null || end === null || start === end) return null;

  const localMs = now.getTime() + SINGAPORE_OFFSET_MS;
  const minute = Math.floor((localMs % DAY_MS) / MINUTE_MS);
  const inside = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!inside) return null;

  const dayStart = Math.floor(localMs / DAY_MS) * DAY_MS - SINGAPORE_OFFSET_MS;
  let releaseAt = dayStart + end * MINUTE_MS;
  if (releaseAt <= now.getTime()) releaseAt += DAY_MS;
  return new Date(releaseAt);
}
