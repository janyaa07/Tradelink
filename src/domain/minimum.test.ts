import { describe, expect, it } from "vitest";
import { belowMinimumText, minimumGap, topUpOptions, type TopUpOption } from "./minimum";

describe("below a supplier's minimum order (BUY-24)", () => {
  it("measures the gap only when there is a minimum and something to order", () => {
    expect(minimumGap(195, 4000)).toBe(3805);
    expect(minimumGap(4000, 4000)).toBe(0);
    expect(minimumGap(5200, 4000)).toBe(0);
    expect(minimumGap(195, 0)).toBe(0);
    expect(minimumGap(0, 4000)).toBe(0);
  });

  it("says how far below, with the right possessive", () => {
    expect(belowMinimumText("Island Spice Traders", 4000, 3805)).toBe("Below Island Spice Traders' S$40.00 minimum by S$38.05.");
    expect(belowMinimumText("Fresh Lane Produce", 6000, 1250)).toBe("Below Fresh Lane Produce's S$60.00 minimum by S$12.50.");
  });

  it("suggests items that close the gap first, smallest first, then the largest of the rest", () => {
    const option = (productId: string, totalCents: number): TopUpOption => ({ productId, name: productId, qty: 1, totalCents });
    const picks = topUpOptions([option("a", 500), option("b", 4500), option("c", 3900), option("d", 1200), option("e", 6000)], 3805);
    expect(picks.map((pick) => pick.productId)).toEqual(["c", "b", "e", "d", "a"]);
  });

  it("suggests at most five", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ productId: `p${index}`, name: "x", qty: 1, totalCents: 100 * (index + 1) }));
    expect(topUpOptions(many, 10_000)).toHaveLength(5);
  });
});
