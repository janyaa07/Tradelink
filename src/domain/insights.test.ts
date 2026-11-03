import { describe, expect, it } from "vitest";
import {
  budgetLeft,
  countsAsSpend,
  onTimePercent,
  overchargesCaughtCents,
  spendBySupplier,
  weekStarts,
  weeklySpend,
  type SpendOrder,
} from "./insights";

// Tuesday 3 November 2026, 10:00 in Singapore.
const NOW = new Date("2026-11-03T02:00:00Z");

function order(createdAt: string, cents: number, status = "delivered", supplierId = "s1"): SpendOrder {
  return { status, supplierId, createdAt, lines: [{ qty: 1, unitPrice: (cents / 100).toFixed(2) }] };
}

describe("week buckets", () => {
  it("starts each of the last five weeks at Monday 00:00 in Singapore", () => {
    expect(weekStarts(NOW).map((start) => start.toISOString())).toEqual([
      "2026-10-04T16:00:00.000Z",
      "2026-10-11T16:00:00.000Z",
      "2026-10-18T16:00:00.000Z",
      "2026-10-25T16:00:00.000Z",
      "2026-11-01T16:00:00.000Z",
    ]);
  });

  it("treats Monday just after midnight in Singapore as the new week", () => {
    const mondayMorning = new Date("2026-11-01T16:00:30Z");
    expect(weekStarts(mondayMorning).at(-1)?.toISOString()).toBe("2026-11-01T16:00:00.000Z");
    const sundayNight = new Date("2026-11-01T15:59:59Z");
    expect(weekStarts(sundayNight).at(-1)?.toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });

  it("buckets spend by Singapore week and marks this week", () => {
    const weeks = weeklySpend(
      [
        order("2026-11-01T16:00:00Z", 1000), // Monday 00:00, this week
        order("2026-11-03T01:00:00Z", 250), // this week
        order("2026-11-01T15:59:59Z", 700), // Sunday 23:59:59, last week
        order("2026-10-05T00:00:00Z", 300), // Monday 5 Oct, 08:00, oldest week
        order("2026-10-04T15:59:59Z", 9900), // before the oldest week
        order("2026-11-09T00:00:00Z", 9900), // next week
      ],
      NOW,
    );
    expect(weeks).toEqual([
      { startDate: "2026-10-05", isThisWeek: false, cents: 300 },
      { startDate: "2026-10-12", isThisWeek: false, cents: 0 },
      { startDate: "2026-10-19", isThisWeek: false, cents: 0 },
      { startDate: "2026-10-26", isThisWeek: false, cents: 700 },
      { startDate: "2026-11-02", isThisWeek: true, cents: 1250 },
    ]);
  });
});

describe("spend", () => {
  it("leaves out rejected and cancelled orders", () => {
    expect(countsAsSpend("rejected")).toBe(false);
    expect(countsAsSpend("cancelled")).toBe(false);
    for (const status of ["pending", "accepted", "out_for_delivery", "delivered"]) expect(countsAsSpend(status)).toBe(true);
    const weeks = weeklySpend(
      [
        order("2026-11-02T01:00:00Z", 500, "pending"),
        order("2026-11-02T01:00:00Z", 800, "rejected"),
        order("2026-11-02T01:00:00Z", 900, "cancelled"),
      ],
      NOW,
    );
    expect(weeks.at(-1)?.cents).toBe(500);
  });

  it("sums lines in cents without floating point drift", () => {
    const [week] = weeklySpend(
      [{ status: "accepted", supplierId: "s1", createdAt: "2026-11-02T01:00:00Z", lines: [{ qty: 3, unitPrice: "0.10" }, { qty: 7, unitPrice: "12.35" }] }],
      NOW,
      1,
    );
    expect(week?.cents).toBe(30 + 8645);
  });

  it("totals spend by supplier, largest first, without rejected or cancelled orders", () => {
    expect(
      spendBySupplier([
        order("2026-11-02T01:00:00Z", 500, "delivered", "a"),
        order("2026-11-02T01:00:00Z", 900, "accepted", "b"),
        order("2026-11-02T01:00:00Z", 600, "pending", "a"),
        order("2026-11-02T01:00:00Z", 5000, "cancelled", "c"),
        order("2026-11-02T01:00:00Z", 5000, "rejected", "b"),
      ]),
    ).toEqual([
      { supplierId: "a", cents: 1100 },
      { supplierId: "b", cents: 900 },
    ]);
  });
});

describe("on time", () => {
  it("is null when nothing has been delivered", () => {
    expect(onTimePercent([])).toBeNull();
    expect(onTimePercent([{ deliveredAt: null, confirmedDate: "2026-11-02" }])).toBeNull();
  });

  it("compares the Singapore delivery date with the confirmed date", () => {
    expect(
      onTimePercent([
        { deliveredAt: "2026-11-02T15:59:00Z", confirmedDate: "2026-11-02" }, // 23:59 on the day: on time
        { deliveredAt: "2026-11-02T16:00:00Z", confirmedDate: "2026-11-02" }, // 00:00 next day: late
        { deliveredAt: "2026-10-30T02:00:00Z", confirmedDate: "2026-10-31" }, // early: on time
      ]),
    ).toBe(67);
  });

  it("leaves out deliveries without a confirmed date", () => {
    expect(
      onTimePercent([
        { deliveredAt: "2026-11-02T01:00:00Z", confirmedDate: "2026-11-02" },
        { deliveredAt: "2026-11-05T01:00:00Z", confirmedDate: null },
      ]),
    ).toBe(100);
  });
});

describe("overcharges caught", () => {
  it("adds promised and received credits only", () => {
    expect(
      overchargesCaughtCents([
        { status: "credit_promised", amount: "8.40" },
        { status: "credit_received", amount: "12.10" },
        { status: "open", amount: "50.00" },
        { status: "disputed", amount: "20.00" },
        { status: "closed", amount: "3.00" },
        { status: "replacement_promised", amount: "4.00" },
      ]),
    ).toBe(2050);
  });

  it("is zero with no credits", () => {
    expect(overchargesCaughtCents([])).toBe(0);
  });
});

describe("budget", () => {
  it("never goes below zero and flags overspending", () => {
    expect(budgetLeft(90000, 30000)).toEqual({ left: 60000, over: false });
    expect(budgetLeft(90000, 90000)).toEqual({ left: 0, over: false });
    expect(budgetLeft(90000, 95000)).toEqual({ left: 0, over: true });
  });
});
