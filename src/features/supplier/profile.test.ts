import { describe, expect, it } from "vitest";
import { formatCutoff, formatDeliveryDays, formatLeadTime, isCutoffTime } from "./profile";

describe("formatDeliveryDays", () => {
  it("joins runs of three or more days", () => {
    expect(formatDeliveryDays([1, 2, 3, 4, 5, 6])).toBe("Mon to Sat");
    expect(formatDeliveryDays([1, 2, 3, 5])).toBe("Mon to Wed, Fri");
  });

  it("lists short runs and single days", () => {
    expect(formatDeliveryDays([5, 1, 3])).toBe("Mon, Wed, Fri");
    expect(formatDeliveryDays([6, 7])).toBe("Sat, Sun");
  });

  it("ignores duplicates and says when nothing is set", () => {
    expect(formatDeliveryDays([2, 2])).toBe("Tue");
    expect(formatDeliveryDays([])).toBe("Not set");
  });
});

describe("profile values", () => {
  it("formats lead time", () => {
    expect(formatLeadTime(0)).toBe("Same day");
    expect(formatLeadTime(1)).toBe("1 day");
    expect(formatLeadTime(2)).toBe("2 days");
  });

  it("formats and checks the cut-off as a 24-hour time", () => {
    expect(formatCutoff("16:00:00")).toBe("16:00");
    expect(isCutoffTime("09:30")).toBe(true);
    expect(isCutoffTime("24:00")).toBe(false);
    expect(isCutoffTime("4pm")).toBe(false);
  });
});
