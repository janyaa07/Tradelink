import { describe, expect, it } from "vitest";
import { decide, minutesOf, quietHoursEnd, type PolicyInput } from "./policy";

/** A Singapore wall-clock time on 3 November 2026 as an instant (Singapore is UTC+8). */
function sgt(time: string, day = 3): Date {
  return new Date(`2026-11-${String(day).padStart(2, "0")}T${time}:00+08:00`);
}

const QUIET = { start: "22:00", end: "06:00" };

function input(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    promptKind: "unprompted",
    type: "arrival_check",
    now: sgt("14:00"),
    quietHours: QUIET,
    unpromptedToday: 0,
    dailyLimit: 2,
    mutedTypes: [],
    pushOffTypes: [],
    hasPushDevice: true,
    ignoredStreak: 0,
    sameItemToday: false,
    ...overrides,
  };
}

describe("quietHoursEnd", () => {
  it("holds until 6am the next day for a window that crosses midnight", () => {
    expect(quietHoursEnd(sgt("23:30"), QUIET)).toEqual(sgt("06:00", 4));
    expect(quietHoursEnd(sgt("22:00"), QUIET)).toEqual(sgt("06:00", 4));
  });

  it("holds until 6am the same day after midnight", () => {
    expect(quietHoursEnd(sgt("00:10"), QUIET)).toEqual(sgt("06:00"));
    expect(quietHoursEnd(sgt("05:59"), QUIET)).toEqual(sgt("06:00"));
  });

  it("is outside quiet hours at the end minute and during the day", () => {
    expect(quietHoursEnd(sgt("06:00"), QUIET)).toBeNull();
    expect(quietHoursEnd(sgt("21:59"), QUIET)).toBeNull();
  });

  it("handles a window inside one day", () => {
    const afternoon = { start: "13:00", end: "15:30" };
    expect(quietHoursEnd(sgt("14:00"), afternoon)).toEqual(sgt("15:30"));
    expect(quietHoursEnd(sgt("15:30"), afternoon)).toBeNull();
    expect(quietHoursEnd(sgt("12:59"), afternoon)).toBeNull();
  });

  it("treats equal or malformed times as no quiet hours, and accepts seconds", () => {
    expect(quietHoursEnd(sgt("23:00"), { start: "06:00", end: "06:00" })).toBeNull();
    expect(quietHoursEnd(sgt("23:00"), { start: "25:00", end: "06:00" })).toBeNull();
    expect(quietHoursEnd(sgt("23:00"), { start: "22:00:00", end: "06:00:00" })).toEqual(sgt("06:00", 4));
    expect(minutesOf("07:45")).toBe(465);
    expect(minutesOf("7:45")).toBeNull();
  });
});

describe("decide", () => {
  it("pushes an unprompted message now within the limit and outside quiet hours", () => {
    expect(decide(input())).toEqual({ push: "now", reason: "within_limit" });
  });

  it("holds an unprompted message in quiet hours until they end", () => {
    expect(decide(input({ now: sgt("23:15") }))).toEqual({ push: "hold", releaseAt: sgt("06:00", 4), reason: "quiet_hours" });
    expect(decide(input({ now: sgt("23:15"), quietHours: null }))).toEqual({ push: "now", reason: "within_limit" });
  });

  it("skips the push once the daily limit is reached, so the alert waits for the next brief", () => {
    expect(decide(input({ unpromptedToday: 2 }))).toEqual({ push: "skip", reason: "daily_limit" });
    expect(decide(input({ unpromptedToday: 1 }))).toEqual({ push: "now", reason: "within_limit" });
    expect(decide(input({ dailyLimit: 0 }))).toEqual({ push: "skip", reason: "daily_limit" });
    expect(decide(input({ unpromptedToday: 2, now: sgt("23:00") }))).toEqual({ push: "skip", reason: "daily_limit" });
  });

  it("sends urgent messages at once, past quiet hours, the limit, mutes and push-off", () => {
    const urgent = input({
      promptKind: "urgent",
      now: sgt("02:00"),
      unpromptedToday: 9,
      mutedTypes: ["arrival_check"],
      pushOffTypes: ["arrival_check"],
      ignoredStreak: 5,
      sameItemToday: true,
    });
    expect(decide(urgent)).toEqual({ push: "now", reason: "urgent" });
  });

  it("sends prompted replies at once, without counting against the limit or quiet hours", () => {
    expect(decide(input({ promptKind: "prompted", now: sgt("23:30"), unpromptedToday: 5 }))).toEqual({ push: "now", reason: "prompted" });
  });

  it("skips muted and push-off types, prompted or not", () => {
    expect(decide(input({ mutedTypes: ["arrival_check"] }))).toEqual({ push: "skip", reason: "muted" });
    expect(decide(input({ pushOffTypes: ["arrival_check"] }))).toEqual({ push: "skip", reason: "push_off" });
    expect(decide(input({ promptKind: "prompted", mutedTypes: ["arrival_check"] }))).toEqual({ push: "skip", reason: "muted" });
    expect(decide(input({ mutedTypes: ["support_reply"] }))).toEqual({ push: "now", reason: "within_limit" });
  });

  it("mutes an unprompted type ignored 3 times in a row", () => {
    expect(decide(input({ ignoredStreak: 3 }))).toEqual({ push: "skip", reason: "ignored", muteType: true });
    expect(decide(input({ ignoredStreak: 2 }))).toEqual({ push: "now", reason: "within_limit" });
  });

  it("merges a second push about the same item on the same day", () => {
    expect(decide(input({ sameItemToday: true }))).toEqual({ push: "skip", reason: "merged" });
  });

  it("skips every kind when there is no push device", () => {
    for (const promptKind of ["prompted", "unprompted", "urgent"] as const) {
      expect(decide(input({ promptKind, hasPushDevice: false }))).toEqual({ push: "skip", reason: "no_device" });
    }
  });
});
