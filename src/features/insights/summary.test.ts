import { describe, expect, it } from "vitest";
import { insightsSummary, type SummaryFacts } from "./summary";

const BASE: SummaryFacts = {
  spentCents: 18840,
  lastWeekCents: 13200,
  budgetCents: 70000,
  weeks: 5,
  bySupplier: [],
  priceChangesUp: 0,
  priceChangesDown: 0,
};

describe("insightsSummary", () => {
  it("says the budget is on track, names a supplier with most of the spend and counts price moves", () => {
    const text = insightsSummary({
      ...BASE,
      bySupplier: [
        { id: "a", name: "Island Spice Traders", percent: 54 },
        { id: "b", name: "Harbour Dry Goods", percent: 46 },
      ],
      priceChangesUp: 2,
    });
    expect(text).toBe(
      "Spend is on track for the budget, 27% used this week. Island Spice Traders is 54% of your spend over the last 5 weeks. On your usual items, 2 went up in price.",
    );
  });

  it("warns near the budget and says how far over it is", () => {
    expect(insightsSummary({ ...BASE, spentCents: 60000 })).toBe("This week has used 86% of the budget, so it is getting close.");
    expect(insightsSummary({ ...BASE, spentCents: 75000 })).toBe("This week is S$50.00 over the budget.");
  });

  it("compares with last week when there is no budget", () => {
    expect(insightsSummary({ ...BASE, budgetCents: 0 })).toBe("You spent S$188.40 this week, 43% more than last week.");
    expect(insightsSummary({ ...BASE, budgetCents: 0, lastWeekCents: 0 })).toBe("You spent S$188.40 this week.");
  });

  it("leaves out a supplier that is not most of the spend, and the folded Other row", () => {
    const onTrack = "Spend is on track for the budget, 27% used this week.";
    const small = [
      { id: "a", name: "A", percent: 35 },
      { id: "b", name: "B", percent: 33 },
    ];
    const other = [
      { id: null, name: "Other", percent: 60 },
      { id: "a", name: "A", percent: 40 },
    ];
    expect(insightsSummary({ ...BASE, bySupplier: small })).toBe(onTrack);
    expect(insightsSummary({ ...BASE, bySupplier: other })).toBe(onTrack);
  });
});
