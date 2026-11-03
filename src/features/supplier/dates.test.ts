import { describe, expect, it } from "vitest";
import { addDays, defaultDeliveryDate, isAllowedDeliveryDate, isIsoDate, todayInSingapore } from "./dates";

// 23:30 UTC on 2 November is 07:30 on 3 November in Singapore.
const LATE_UTC = new Date("2026-11-02T23:30:00Z");

describe("todayInSingapore", () => {
  it("uses the Singapore calendar day, not UTC", () => {
    expect(todayInSingapore(LATE_UTC)).toBe("2026-11-03");
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("isIsoDate", () => {
  it("accepts real dates only", () => {
    expect(isIsoDate("2026-11-04")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("4 Nov")).toBe(false);
  });
});

describe("defaultDeliveryDate", () => {
  it("uses the requested date when it is today or later", () => {
    expect(defaultDeliveryDate("2026-11-06", LATE_UTC)).toBe("2026-11-06");
    expect(defaultDeliveryDate("2026-11-03", LATE_UTC)).toBe("2026-11-03");
  });

  it("falls back to tomorrow when nothing was requested or the date has passed", () => {
    expect(defaultDeliveryDate(null, LATE_UTC)).toBe("2026-11-04");
    expect(defaultDeliveryDate("2026-11-01", LATE_UTC)).toBe("2026-11-04");
  });
});

describe("isAllowedDeliveryDate", () => {
  it("allows today and later in Singapore", () => {
    expect(isAllowedDeliveryDate("2026-11-03", LATE_UTC)).toBe(true);
    expect(isAllowedDeliveryDate("2026-11-02", LATE_UTC)).toBe(false);
    expect(isAllowedDeliveryDate("not a date", LATE_UTC)).toBe(false);
  });
});
