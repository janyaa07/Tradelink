import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/domain/catalogue";
import type { DraftLine } from "./draft";
import { addOne, addUsuals, markAdded, pickProduct, quantitiesByProduct, setQuantity } from "./line-ops";

const RICE = "11111111-1111-4111-8111-111111111111";
const OIL = "22222222-2222-4222-8222-222222222222";

const rice = { id: RICE, packKg: 5 } as const;
const oil = { id: OIL, packKg: null } as const;

function item(base: { id: string; packKg: number | null }): CatalogueItem {
  return {
    ...base,
    supplierOrgId: "s1",
    supplierName: "Harbour Dry Goods",
    sku: "DG-1",
    name: "Product",
    unit: "bag",
    price: "10.00",
    category: "dry_goods",
    art: "sack",
    reorderLevel: 0,
    aliases: [],
    status: "active",
    onHand: 10,
    reserved: 0,
    available: 10,
    health: "healthy",
  };
}

const kgLine: DraftLine = {
  id: "l1",
  sourceText: "10kg rice",
  productId: null,
  qty: 10,
  kg: 10,
  qtyAssumed: false,
  options: [RICE, OIL],
  state: "check",
};

describe("review line edits", () => {
  it("converts a weight to whole packs when the chosen product has a pack weight", () => {
    const [line] = pickProduct([kgLine], "l1", item(rice));
    expect(line).toMatchObject({ productId: RICE, qty: 2, kg: 10, state: "matched" });
  });

  it("drops the weight when the product has no pack weight", () => {
    const [line] = pickProduct([kgLine], "l1", item(oil));
    expect(line).toMatchObject({ productId: OIL, kg: null, state: "matched" });
  });

  it("returns a cleared line to Check this or Not in catalogue", () => {
    expect(pickProduct([kgLine], "l1", null)[0]?.state).toBe("check");
    expect(pickProduct([{ ...kgLine, options: [] }], "l1", null)[0]?.state).toBe("not_found");
  });

  it("clears the assumed quantity once the buyer sets one", () => {
    expect(setQuantity([{ ...kgLine, qtyAssumed: true }], "l1", 3)[0]).toMatchObject({ qty: 3, qtyAssumed: false, kg: null });
  });

  it("adds one to a product already in the order, otherwise a new line", () => {
    const once = addOne([], RICE, "a");
    expect(once).toEqual([
      { id: "a", sourceText: "Added by you", productId: RICE, qty: 1, kg: null, qtyAssumed: false, options: [], state: "manual" },
    ]);
    expect(addOne(once, RICE, "b")[0]?.qty).toBe(2);
  });

  it("adds usual items still in the catalogue at their usual quantity", () => {
    let n = 0;
    const lines = addUsuals(
      [],
      [
        { productId: RICE, usualQty: 4, lastPaid: null },
        { productId: "33333333-3333-4333-8333-333333333333", usualQty: 1, lastPaid: null },
      ],
      new Map([[RICE, item(rice)]]),
      () => `u${(n += 1)}`,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ sourceText: "My usual", productId: RICE, qty: 4, state: "suggested" });
  });

  it("marks a line added to the catalogue and totals quantities", () => {
    const lines = markAdded([kgLine], "l1", OIL);
    expect(lines[0]).toMatchObject({ productId: OIL, state: "added", options: [] });
    expect(quantitiesByProduct([...lines, { ...kgLine, id: "l2", productId: OIL, qty: 2 }]).get(OIL)).toBe(12);
  });
});
