import { describe, expect, it } from "vitest";
import { belowMinimumNote, orderBelowMinimum } from "./minimum";

describe("orders below the minimum order", () => {
  it("measures the gap to the minimum", () => {
    expect(orderBelowMinimum({ status: "pending", totalCents: 195, laterCents: 0 }, 4000)).toBe(3805);
    expect(orderBelowMinimum({ status: "delivered", totalCents: 4000, laterCents: 0 }, 4000)).toBe(0);
  });

  it("counts the rest of a two-delivery order", () => {
    expect(orderBelowMinimum({ status: "accepted", totalCents: 2000, laterCents: 2500 }, 4000)).toBe(0);
  });

  it("ignores rejected and cancelled orders and a minimum of zero", () => {
    expect(orderBelowMinimum({ status: "rejected", totalCents: 195, laterCents: 0 }, 4000)).toBe(0);
    expect(orderBelowMinimum({ status: "cancelled", totalCents: 195, laterCents: 0 }, 4000)).toBe(0);
    expect(orderBelowMinimum({ status: "accepted", totalCents: 195, laterCents: 0 }, 0)).toBe(0);
  });

  it("says by how much", () => {
    expect(belowMinimumNote(3805, 4000)).toBe("S$38.05 below your S$40.00 minimum");
  });
});
