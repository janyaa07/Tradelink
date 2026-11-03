import { describe, expect, it } from "vitest";
import { buildTodos, percentChange, replyText } from "./todos";

const priceUp = { id: "c1", productName: "Jasmine rice 5kg", supplierName: "Harbour Dry Goods", oldPrice: "11.90", newPrice: "12.40" };
const priceDown = { ...priceUp, id: "c2", oldPrice: "9.40", newPrice: "8.90" };
const partial = {
  id: "p1",
  productName: "Eggs",
  supplierName: "Fresh Lane Produce",
  orderRef: "ORD-1044",
  asked: 10,
  sent: 6,
};
const dispute = { id: "i1", orderRef: "ORD-1040", supplierName: "Harbour Dry Goods", status: "disputed", amount: "8.40" };
const credit = { ...dispute, id: "i2", status: "credit_promised" };

describe("to do", () => {
  it("describes price changes with one decimal", () => {
    expect(percentChange("11.90", "12.40")).toBe("4.2");
    const [up, down] = buildTodos({ priceChanges: [priceUp], partials: [], replies: [] }, true).concat(
      buildTodos({ priceChanges: [priceDown], partials: [], replies: [] }, true),
    );
    expect(up).toMatchObject({
      tone: "warn",
      title: "Jasmine rice 5kg went up 4.2%",
      detail: "S$11.90 to S$12.40 at Harbour Dry Goods.",
    });
    expect(down).toMatchObject({ tone: "good", title: "Jasmine rice 5kg went down 5.3%" });
  });

  it("hides price changes when price alerts are off", () => {
    expect(buildTodos({ priceChanges: [priceUp], partials: [], replies: [] }, false)).toEqual([]);
  });

  it("offers the rest of a part delivery", () => {
    const [todo] = buildTodos({ priceChanges: [], partials: [partial], replies: [] }, true);
    expect(todo).toMatchObject({
      title: "Fresh Lane Produce can only send 6 of 10",
      detail: "Eggs on ORD-1044.",
      action: { kind: "partial", id: "p1", remainder: 4 },
    });
  });

  it("uses the copy for each reply and puts disputes first", () => {
    const todos = buildTodos({ priceChanges: [priceUp], partials: [], replies: [credit, dispute] }, true);
    expect(todos.map((todo) => todo.tone)).toEqual(["bad", "warn", "good"]);
    expect(todos[0]).toMatchObject({ title: "Reply on ORD-1040", detail: "Harbour Dry Goods disputes this. Tradelink is reviewing it." });
    expect(todos[2]?.detail).toBe("Harbour Dry Goods will credit S$8.40.");
  });

  it("has no reply item for open or received issues", () => {
    expect(replyText("open", "X", "1.00")).toBeNull();
    expect(replyText("credit_received", "X", "1.00")).toBeNull();
    expect(replyText("closed", "X", "1.00")).toBe("Tradelink reviewed this and closed it with no credit.");
  });
});
