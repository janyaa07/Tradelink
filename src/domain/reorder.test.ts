import { describe, expect, it } from "vitest";
import { daysLeft, formatDaysLeft, reorderPlan, reorderQuantity, type ReorderInput } from "./reorder";

const item = (overrides: Partial<ReorderInput> = {}): ReorderInput => ({
  productId: "p1",
  inShop: 2,
  usePerDay: 1,
  onOrder: 0,
  available: 50,
  skippedToday: false,
  ...overrides,
});

describe("reorder plan", () => {
  it("counts days left from shop stock and open orders", () => {
    expect(daysLeft(2, 1, 1.5)).toBe(2);
    expect(daysLeft(5, 0, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(formatDaysLeft(2.04)).toBe("2.0");
  });

  it("suggests enough for a week, less what is in the shop and on order", () => {
    expect(reorderQuantity(item({ inShop: 2, usePerDay: 1, onOrder: 1 }))).toBe(4);
    expect(reorderQuantity(item({ inShop: 0, usePerDay: 0.3 }))).toBe(3);
  });

  it("never suggests more than is available, but at least one", () => {
    expect(reorderQuantity(item({ inShop: 0, usePerDay: 2, available: 5 }))).toBe(5);
    expect(reorderQuantity(item({ inShop: 0, usePerDay: 2, available: 0 }))).toBe(1);
    expect(reorderQuantity(item({ inShop: 6.9, usePerDay: 1 }))).toBe(1);
  });

  it("lists only items with less than 3 days left that were not skipped today", () => {
    const plan = reorderPlan(
      [
        item({ productId: "low", inShop: 2 }),
        item({ productId: "enough", inShop: 3 }),
        item({ productId: "skipped", inShop: 0, skippedToday: true }),
        item({ productId: "unused", inShop: 0, usePerDay: 0 }),
      ],
      true,
    );
    expect(plan.map((row) => row.productId)).toEqual(["low"]);
    expect(plan[0]).toMatchObject({ daysLeft: 2, want: 5, qty: 5 });
  });

  it("returns nothing when suggestions are off", () => {
    expect(reorderPlan([item({ inShop: 0 })], false)).toEqual([]);
  });
});
