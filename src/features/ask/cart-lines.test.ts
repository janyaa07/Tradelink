import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/domain/catalogue";
import type { DraftLine } from "@/features/ordering/draft";
import { hasUsableLine, lineRow, linesForCatalogue, productCartLine, readRows, toCartLine } from "./cart-lines";

const EGGS = "aaaaaaaa-0000-4000-8000-000000000001";
const MILK = "aaaaaaaa-0000-4000-8000-000000000002";
const HIDDEN = "aaaaaaaa-0000-4000-8000-000000000009";

function item(id: string, name: string, price: string): CatalogueItem {
  return {
    id,
    supplierOrgId: "s1",
    supplierName: "Harbour Dry Goods",
    sku: "SKU",
    name,
    unit: "carton",
    price,
    category: "fresh",
    art: "egg",
    packKg: null,
    reorderLevel: 0,
    aliases: [],
    status: "active",
    onHand: 10,
    reserved: 0,
    available: 10,
    health: "healthy",
  };
}

const byId = new Map([
  [EGGS, item(EGGS, "Fresh eggs", "52.00")],
  [MILK, item(MILK, "Evaporated milk", "1.20")],
]);

function read(overrides: Partial<DraftLine>): DraftLine {
  return { id: "r1", sourceText: "", productId: null, qty: 1, kg: null, qtyAssumed: false, options: [], state: "not_found", ...overrides };
}

describe("chat lines to cart lines", () => {
  it("keeps each read line's product, quantity, options, state, weight and assumed quantity", () => {
    expect(toCartLine(read({ sourceText: "10kg rice", productId: null, qty: 2, kg: 10, qtyAssumed: true, options: [EGGS], state: "check" }))).toEqual({
      productId: null,
      qty: 2,
      sourceText: "10kg rice",
      options: [EGGS],
      state: "check",
      kg: 10,
      qtyAssumed: true,
    });
  });

  it("builds suggested and manual lines for catalogue products", () => {
    expect(productCartLine(EGGS, 3, "My usual", "suggested")).toEqual({
      productId: EGGS,
      qty: 3,
      sourceText: "My usual",
      options: [],
      state: "suggested",
      kg: null,
      qtyAssumed: false,
    });
  });

  it("shows each read line with its state and price, or what was typed when there is no product", () => {
    const lines = [
      read({ sourceText: "2 ctn eggs", productId: EGGS, qty: 2, state: "matched" }),
      read({ sourceText: "milk", options: [MILK], state: "check" }),
      read({ sourceText: "wagyu" }),
    ];
    expect(readRows(lines, byId)).toEqual([
      { label: "2 × Fresh eggs", status: "Matched", note: null, price: "S$104.00" },
      { label: "milk", status: "Check this", note: null, price: null },
      { label: "wagyu", status: "Not found", note: null, price: null },
    ]);
    expect(lineRow(productCartLine(MILK, 10, "My usual", "suggested"), byId, "2 days left")).toEqual({
      label: "10 × Evaporated milk",
      status: null,
      note: "2 days left",
      price: "S$12.00",
    });
  });

  it("offers Add to cart only when a line matched or has candidates", () => {
    expect(hasUsableLine([read({})])).toBe(false);
    expect(hasUsableLine([read({}), read({ options: [MILK] })])).toBe(true);
    expect(hasUsableLine([read({ productId: EGGS })])).toBe(true);
  });
});

describe("linesForCatalogue", () => {
  const visible = new Set([EGGS, MILK]);

  it("keeps lines for products the buyer can see and drops hidden candidates", () => {
    const [line] = linesForCatalogue([{ ...productCartLine(EGGS, 2, "2 eggs", "manual"), options: [EGGS, HIDDEN] }], visible);
    expect(line).toMatchObject({ productId: EGGS, options: [EGGS], state: "manual" });
  });

  it("turns a hidden product into Check this when candidates remain, otherwise Not in catalogue", () => {
    const [check, missing] = linesForCatalogue(
      [
        { ...productCartLine(HIDDEN, 1, "oil", "manual"), options: [HIDDEN, MILK] },
        { ...productCartLine(HIDDEN, 1, "wagyu", "manual"), options: [HIDDEN], state: "matched" },
      ],
      visible,
    );
    expect(check).toMatchObject({ productId: null, options: [MILK], state: "check" });
    expect(missing).toMatchObject({ productId: null, options: [], state: "not_found" });
  });

  it("keeps a typed line with no product waiting in the cart", () => {
    const [line] = linesForCatalogue([toCartLine(read({ sourceText: "wagyu", qty: 3 }))], visible);
    expect(line).toEqual({ productId: null, qty: 3, sourceText: "wagyu", options: [], state: "not_found", kg: null, qtyAssumed: false });
  });
});
