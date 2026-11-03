import { describe, expect, it } from "vitest";
import { presenceOf } from "./presence";

const NOW = new Date("2026-11-03T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("presenceOf", () => {
  it("is Online within 5 minutes", () => {
    expect(presenceOf(minutesAgo(0), NOW)).toBe("Online");
    expect(presenceOf(minutesAgo(5), NOW)).toBe("Online");
  });

  it("is Away after 5 and within 30 minutes", () => {
    expect(presenceOf(minutesAgo(5.5), NOW)).toBe("Away");
    expect(presenceOf(minutesAgo(30), NOW)).toBe("Away");
  });

  it("is Offline after 30 minutes", () => {
    expect(presenceOf(minutesAgo(31), NOW)).toBe("Offline");
    expect(presenceOf(minutesAgo(60 * 24), NOW)).toBe("Offline");
  });

  it("is Offline when never seen or unreadable", () => {
    expect(presenceOf(null, NOW)).toBe("Offline");
    expect(presenceOf("not a date", NOW)).toBe("Offline");
  });

  it("treats a clock slightly ahead as Online", () => {
    expect(presenceOf(minutesAgo(-1), NOW)).toBe("Online");
  });
});
