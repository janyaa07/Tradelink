import { describe, expect, it } from "vitest";
import { answerOptions, buildSupplierTodos, issueHeading, issueTodoTitle, type IssueView } from "./issues";

const issue = (overrides: Partial<IssueView>): IssueView => ({
  id: "11111111-1111-4111-8111-111111111111",
  type: "damaged",
  qty: 2,
  amount: "12.40",
  note: null,
  createdAt: "2026-11-03T02:00:00Z",
  orderNumber: 1041,
  buyerName: "Mei's Noodle House",
  productName: "Eggs (tray of 30)",
  ...overrides,
});

describe("issue titles", () => {
  it("follows the To do copy", () => {
    expect(issueTodoTitle(issue({ type: "late" }))).toBe("Late delivery on ORD-1041");
    expect(issueTodoTitle(issue({ type: "invoice" }))).toBe("Invoice query on ORD-1041");
    expect(issueTodoTitle(issue({ type: "damaged" }))).toBe("Damaged item on ORD-1041");
    expect(issueTodoTitle(issue({ type: "wrong_item" }))).toBe("Wrong item on ORD-1041");
  });

  it("follows the problem card copy", () => {
    expect(issueHeading(issue({ type: "short", qty: 3 }))).toBe("Short: 3 × Eggs (tray of 30)");
    expect(issueHeading(issue({ type: "late" }))).toBe("ORD-1041 is late");
    expect(issueHeading(issue({ type: "invoice" }))).toBe("Invoice query on ORD-1041");
  });
});

describe("answerOptions", () => {
  const labels = (value: IssueView) => answerOptions(value).map((option) => option.label);

  it("offers credit, replace and dispute for item problems", () => {
    expect(labels(issue({}))).toEqual(["Credit S$12.40", "Replace next delivery", "Dispute"]);
  });

  it("hides credit when there is no amount", () => {
    expect(labels(issue({ amount: "0.00" }))).toEqual(["Replace next delivery", "Dispute"]);
  });

  it("offers only It is on the way for a late delivery", () => {
    expect(labels(issue({ type: "late", amount: "0.00" }))).toEqual(["It is on the way"]);
  });

  it("answers an invoice query with Invoice is correct, sent as a dispute", () => {
    const options = answerOptions(issue({ type: "invoice", amount: "0.00" }));
    expect(options).toEqual([{ answer: "dispute", label: "Invoice is correct", variant: "danger" }]);
  });
});

describe("buildSupplierTodos", () => {
  it("lists problems, products to confirm, then low stock", () => {
    const todos = buildSupplierTodos(
      [issue({ note: "Two cracked" })],
      [
        { id: "a", name: "Tofu", health: "unconfirmed", available: 0, reorderLevel: 0 },
        { id: "b", name: "Jasmine rice 10kg", health: "low", available: 3, reorderLevel: 5 },
        { id: "c", name: "Cooking oil 2L", health: "out", available: 0, reorderLevel: 4 },
        { id: "d", name: "Sugar 1kg", health: "healthy", available: 40, reorderLevel: 5 },
      ],
    );
    expect(todos.map((todo) => [todo.title, todo.label])).toEqual([
      ["Damaged item on ORD-1041", "Answer"],
      ["Confirm stock for Tofu", "Confirm"],
      ["Jasmine rice 10kg is low", "Receive stock"],
      ["Cooking oil 2L is out of stock", "Receive stock"],
    ]);
    expect(todos[0]?.detail).toBe("Mei's Noodle House: Two cracked");
    expect(todos[1]?.detail).toBe("A buyer added this item.");
    expect(todos[2]?.detail).toBe("3 available, reorder at 5.");
    expect(todos[3]?.tone).toBe("bad");
  });

  it("is empty when there is nothing to do", () => {
    expect(buildSupplierTodos([], [])).toEqual([]);
  });
});
