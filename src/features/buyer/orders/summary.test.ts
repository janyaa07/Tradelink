import { describe, expect, it } from "vitest";
import { issueAnswer, itemSummary, problemSummary, problemTitle, waitingBanner, type IssueFacts } from "./summary";

const short: IssueFacts = {
  type: "short",
  status: "open",
  qty: 2,
  amount: "8.40",
  productName: "Dried noodles",
  supplierName: "Harbour Dry Goods",
};

describe("order row summary", () => {
  it("counts items and names the first two", () => {
    expect(itemSummary(["Dried noodles", "Soy sauce", "Eggs"])).toEqual({ count: "3 items", names: "Dried noodles, Soy sauce" });
    expect(itemSummary(["Eggs"])).toEqual({ count: "1 item", names: "Eggs" });
    expect(itemSummary([])).toEqual({ count: "0 items", names: "" });
  });
});

describe("problem summary", () => {
  it("explains an open problem", () => {
    expect(problemSummary(short)).toBe("Short: 2 × Dried noodles · waiting for Harbour Dry Goods");
  });

  it("names late and invoice problems without an item", () => {
    expect(problemTitle({ ...short, type: "late", productName: null })).toBe("Late: not here yet");
    expect(problemTitle({ ...short, type: "invoice", productName: null })).toBe("Invoice query");
    expect(problemTitle({ ...short, type: "damaged", productName: null })).toBe("Damaged: 2 × an item");
  });

  it("says where an answered problem stands", () => {
    expect(problemSummary({ ...short, status: "credit_promised" })).toBe("Short: 2 × Dried noodles · Harbour Dry Goods will credit S$8.40");
    expect(problemSummary({ ...short, status: "disputed" })).toBe("Short: 2 × Dried noodles · Tradelink is reviewing it");
    expect(problemSummary({ ...short, status: "credit_received" })).toBe("Short: 2 × Dried noodles · credit of S$8.40 received");
  });

  it("gives the supplier's answer as a sentence", () => {
    expect(issueAnswer(short)).toBe("Waiting for Harbour Dry Goods to answer.");
    expect(issueAnswer({ ...short, status: "replacement_promised" })).toBe("Harbour Dry Goods will replace this on the next delivery.");
    expect(issueAnswer({ ...short, status: "credit_received" })).toBe("Harbour Dry Goods credited S$8.40. You marked it received.");
  });

  it("counts problems in the banner", () => {
    expect(waitingBanner(1)).toBe("1 problem waiting for the supplier");
    expect(waitingBanner(3)).toBe("3 problems waiting for the supplier");
  });
});
