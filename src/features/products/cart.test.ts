import { describe, expect, it } from "vitest";
import { MAX_LINE_QTY } from "@/domain/review";
import type { DraftLine } from "@/features/ordering/draft";
import { cartMessage, clampQuantity, productQuantity, setProductQuantity, shownLineCount } from "./cart";

const EGGS = "11111111-1111-4111-8111-111111111111";
const RICE = "22222222-2222-4222-8222-222222222222";

function line(id: string, productId: string | null, qty: number, extra: Partial<DraftLine> = {}): DraftLine {
  return { id, sourceText: "eggs", productId, qty, kg: null, qtyAssumed: false, options: [], state: "matched", ...extra };
}

describe("setProductQuantity", () => {
  it("adds a new Added by you line for a product not in the cart", () => {
    const lines = [line("a", RICE, 2)];
    const next = setProductQuantity(lines, EGGS, 1, "new");
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({
      id: "new",
      sourceText: "Added by you",
      productId: EGGS,
      qty: 1,
      kg: null,
      qtyAssumed: false,
      options: [],
      state: "manual",
    });
    expect(lines).toHaveLength(1);
  });

  it("returns the same lines when the quantity does not change", () => {
    const lines = [line("a", EGGS, 3)];
    expect(setProductQuantity(lines, EGGS, 3, "new")).toBe(lines);
    expect(setProductQuantity(lines, RICE, 0, "new")).toBe(lines);
  });

  it("raises the first line and clears an assumed quantity or weight", () => {
    const lines = [line("a", EGGS, 2, { qtyAssumed: true, kg: 4 }), line("b", EGGS, 1)];
    const next = setProductQuantity(lines, EGGS, 5, "new");
    expect(next.map((l) => [l.id, l.qty])).toEqual([
      ["a", 4],
      ["b", 1],
    ]);
    expect(next[0]).toMatchObject({ qtyAssumed: false, kg: null });
  });

  it("lowers the last lines first and removes lines that reach 0", () => {
    const lines = [line("a", EGGS, 3), line("r", RICE, 1), line("b", EGGS, 2)];
    expect(setProductQuantity(lines, EGGS, 4, "new").map((l) => [l.id, l.qty])).toEqual([
      ["a", 3],
      ["r", 1],
      ["b", 1],
    ]);
    expect(setProductQuantity(lines, EGGS, 2, "new").map((l) => [l.id, l.qty])).toEqual([
      ["a", 2],
      ["r", 1],
    ]);
  });

  it("removes the product at 0 and keeps other lines, including lines with no product", () => {
    const lines = [line("x", null, 1, { state: "not_found" }), line("a", EGGS, 3), line("b", EGGS, 2)];
    expect(setProductQuantity(lines, EGGS, 0, "new").map((l) => l.id)).toEqual(["x"]);
    expect(setProductQuantity(lines, EGGS, -4, "new").map((l) => l.id)).toEqual(["x"]);
  });

  it("caps the quantity at the line maximum", () => {
    const next = setProductQuantity([], EGGS, MAX_LINE_QTY + 50, "new");
    expect(next[0]?.qty).toBe(MAX_LINE_QTY);
  });
});

describe("clampQuantity and productQuantity", () => {
  it("keeps whole quantities from 0 to the maximum", () => {
    expect(clampQuantity(-1)).toBe(0);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(Number.NaN)).toBe(0);
    expect(clampQuantity(MAX_LINE_QTY + 1)).toBe(MAX_LINE_QTY);
  });

  it("totals a product across lines", () => {
    expect(productQuantity([line("a", EGGS, 3), line("r", RICE, 1), line("b", EGGS, 2)], EGGS)).toBe(5);
    expect(productQuantity([], EGGS)).toBe(0);
  });
});

describe("shownLineCount", () => {
  it("counts products added and removed since the last save", () => {
    expect(shownLineCount(3, { [EGGS]: 2 }, { [EGGS]: 2 })).toBe(3);
    expect(shownLineCount(3, { [EGGS]: 2 }, { [EGGS]: 2, [RICE]: 1 })).toBe(4);
    expect(shownLineCount(3, { [EGGS]: 2 }, { [EGGS]: 0 })).toBe(2);
    expect(shownLineCount(0, {}, { [RICE]: 0 })).toBe(0);
  });
});

describe("cartMessage", () => {
  it("names the product and the change", () => {
    expect(cartMessage("Eggs", 0, 1)).toBe("Eggs added to cart.");
    expect(cartMessage("Eggs", 1, 2)).toBe("Eggs: 2 in cart.");
    expect(cartMessage("Eggs", 1, 0)).toBe("Eggs removed from cart.");
  });
});
