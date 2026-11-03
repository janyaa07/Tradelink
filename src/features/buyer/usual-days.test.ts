import { describe, expect, it } from "vitest";
import { daysLabel, daysTone, liveDaysLeft } from "./usual-days";

describe("days left pill", () => {
  it("is bad under 1 day, a warning under 3 and good otherwise", () => {
    expect(daysTone(0.4)).toBe("bad");
    expect(daysTone(1)).toBe("warn");
    expect(daysTone(2.9)).toBe("warn");
    expect(daysTone(3)).toBe("good");
    expect(daysTone(Number.POSITIVE_INFINITY)).toBe("plain");
  });

  it("says the days in words", () => {
    expect(daysLabel(2.46)).toBe("2.5 days left");
    expect(daysLabel(Number.POSITIVE_INFINITY)).toBe("No daily use");
  });

  it("follows the fields being edited and counts stock on order", () => {
    expect(liveDaysLeft("4", "2", 2)).toBe(3);
    expect(liveDaysLeft("4", "0", 0)).toBe(Number.POSITIVE_INFINITY);
    expect(liveDaysLeft("", "2", 0)).toBeNull();
    expect(liveDaysLeft("x", "2", 0)).toBeNull();
  });
});
