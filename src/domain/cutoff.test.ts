import { describe, expect, it } from "vitest";
import { cutoffText, DEFAULT_TERMS, earliestDelivery } from "./cutoff";
import { singaporeClockOf, singaporeDateOf, startOfWeekSingapore } from "./singapore-time";

// Tuesday 3 November 2026 in Singapore.
const TUESDAY_10AM = new Date("2026-11-03T02:00:00Z");
const TUESDAY_5PM = new Date("2026-11-03T09:00:00Z");
const FRIDAY_5PM = new Date("2026-11-06T09:00:00Z");

describe("Singapore time", () => {
  it("reads the weekday and time in Singapore, not UTC", () => {
    expect(singaporeClockOf(new Date("2026-11-02T17:30:00Z"))).toEqual({ isoWeekday: 2, minutes: 90 });
  });

  it("gives the calendar date in Singapore", () => {
    expect(singaporeDateOf(new Date("2026-11-02T16:30:00Z"))).toBe("2026-11-03");
  });

  it("starts the week on Monday at midnight in Singapore", () => {
    expect(startOfWeekSingapore(TUESDAY_10AM).toISOString()).toBe("2026-11-01T16:00:00.000Z");
    expect(startOfWeekSingapore(new Date("2026-11-01T15:59:00Z")).toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });
});

describe("cut-off", () => {
  it("says order by the cut-off for tomorrow before the cut-off", () => {
    expect(cutoffText(DEFAULT_TERMS, TUESDAY_10AM)).toBe("Order by 16:00 for tomorrow");
    expect(cutoffText({ ...DEFAULT_TERMS, cutoffTime: "09:30:00" }, new Date("2026-11-03T01:00:00Z"))).toBe(
      "Order by 09:30 for tomorrow",
    );
  });

  it("names the earliest delivery day after the cut-off", () => {
    expect(cutoffText(DEFAULT_TERMS, TUESDAY_5PM)).toBe("Past cut-off, earliest delivery is Thursday");
  });

  it("skips days the supplier does not deliver", () => {
    expect(earliestDelivery(DEFAULT_TERMS, FRIDAY_5PM)).toEqual({ pastCutoff: true, daysAhead: 3, isoWeekday: 1 });
    expect(cutoffText(DEFAULT_TERMS, FRIDAY_5PM)).toBe("Past cut-off, earliest delivery is Monday");
    expect(cutoffText({ ...DEFAULT_TERMS, deliveryDays: [1, 4, 6] }, TUESDAY_10AM)).toBe(
      "Order by 16:00 for delivery on Thursday",
    );
  });

  it("adds the lead time", () => {
    expect(cutoffText({ ...DEFAULT_TERMS, leadTimeDays: 2 }, TUESDAY_10AM)).toBe("Order by 16:00 for delivery on Thursday");
  });
});
