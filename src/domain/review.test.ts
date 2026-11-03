import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "./catalogue";
import {
  checkLines,
  guessProductName,
  guessUnit,
  isOverBudget,
  isPriceAboveLastPaid,
  mergeLines,
  parseStockShort,
  subtotalsBySupplier,
  wholeQuantity,
} from "./review";

const RICE = "11111111-1111-4111-8111-111111111111";
const OIL = "22222222-2222-4222-8222-222222222222";
const NEW = "33333333-3333-4333-8333-333333333333";

function product(id: string, overrides: Partial<CatalogueItem> = {}): CatalogueItem {
  return {
    id,
    supplierOrgId: "s1",
    supplierName: "Harbour Dry Goods",
    sku: "DG-1",
    name: "Jasmine rice 5kg",
    unit: "bag",
    price: "12.40",
    category: "dry_goods",
    art: "sack",
    packKg: 5,
    reorderLevel: 5,
    aliases: [],
    status: "active",
    onHand: 10,
    reserved: 2,
    available: 8,
    health: "healthy",
    ...overrides,
  };
}

const catalogue = new Map([
  [RICE, product(RICE)],
  [OIL, product(OIL, { supplierOrgId: "s2", supplierName: "Bright Pantry", price: "9.40", available: 3 })],
  [NEW, product(NEW, { status: "unconfirmed", available: 0, price: "4.00" })],
]);

describe("review checks", () => {
  it("counts unresolved lines and merges quantities per product", () => {
    const check = checkLines(
      [
        { productId: RICE, qty: 5 },
        { productId: RICE, qty: 4 },
        { productId: null, qty: 1 },
        { productId: OIL, qty: 3 },
      ],
      catalogue,
    );
    expect(check.unresolved).toBe(1);
    expect(check.need.get(RICE)).toBe(9);
    expect(check.over).toEqual([RICE]);
  });

  it("never blocks products whose stock is still to be confirmed", () => {
    expect(checkLines([{ productId: NEW, qty: 20 }], catalogue).over).toEqual([]);
  });

  it("splits totals by supplier in integer cents", () => {
    const { need } = checkLines(
      [
        { productId: RICE, qty: 2 },
        { productId: OIL, qty: 3 },
        { productId: NEW, qty: 1 },
      ],
      catalogue,
    );
    expect(subtotalsBySupplier(need, catalogue)).toEqual([
      { supplierOrgId: "s2", supplierName: "Bright Pantry", totalCents: 2820 },
      { supplierOrgId: "s1", supplierName: "Harbour Dry Goods", totalCents: 2880 },
    ]);
  });
});

describe("quantities and prices", () => {
  it("turns anything but a whole number above 0 into 1", () => {
    expect(wholeQuantity("4")).toBe(4);
    expect(wholeQuantity("0")).toBe(1);
    expect(wholeQuantity("2.5")).toBe(1);
    expect(wholeQuantity("")).toBe(1);
    expect(wholeQuantity(-3)).toBe(1);
    expect(wholeQuantity(20000)).toBe(9999);
  });

  it("warns only above 2% more than the last price paid", () => {
    expect(isPriceAboveLastPaid("10.20", "10.00")).toBe(false);
    expect(isPriceAboveLastPaid("10.21", "10.00")).toBe(true);
    expect(isPriceAboveLastPaid("10.21", null)).toBe(false);
  });

  it("warns when the order takes the week over budget", () => {
    expect(isOverBudget(80000, 10000, 90000)).toBe(false);
    expect(isOverBudget(80000, 10001, 90000)).toBe(true);
  });

  it("adds quantity to a product already in the order", () => {
    const merged = mergeLines(
      [
        { productId: RICE, qty: 2 },
        { productId: null, qty: 1 },
      ],
      [
        { productId: RICE, qty: 3 },
        { productId: OIL, qty: 1 },
        { productId: null, qty: 2 },
      ],
    );
    expect(merged).toEqual([
      { productId: RICE, qty: 5 },
      { productId: null, qty: 1 },
      { productId: OIL, qty: 1 },
      { productId: null, qty: 2 },
    ]);
  });
});

describe("stock short detail", () => {
  it("reads the products and what is available", () => {
    const detail = JSON.stringify([{ productId: RICE, available: 3 }]);
    expect(parseStockShort(detail)).toEqual(new Map([[RICE, 3]]));
  });

  it("ignores detail that is not the expected JSON", () => {
    expect(parseStockShort("not json").size).toBe(0);
    expect(parseStockShort(undefined).size).toBe(0);
    expect(parseStockShort('[{"productId":"x"}]').size).toBe(0);
  });
});

describe("add to catalogue defaults", () => {
  it("suggests a name without the quantity or unit", () => {
    expect(guessProductName("3 ctn red lentils")).toBe("Red lentils");
    expect(guessProductName("- need 2 tins coconut milk pls")).toBe("Coconut milk");
  });

  it("maps typed pack words to units", () => {
    expect(guessUnit("3 ctns lentils")).toBe("carton");
    expect(guessUnit("2 btl soy sauce")).toBe("bottle");
    expect(guessUnit("10kg flour")).toBe("bag");
    expect(guessUnit("lentils")).toBe("pack");
  });
});
