import { describe, expect, it } from "vitest";
import type { CatalogueItem, Unit } from "@/domain/catalogue";
import { findPriceProduct, productsNamedIn } from "./products";

function product(id: string, name: string, unit: Unit, aliases: string[]): CatalogueItem {
  return {
    id,
    supplierOrgId: "s1",
    supplierName: "Harbour Dry Goods",
    sku: id.toUpperCase(),
    name,
    unit,
    price: "10.00",
    category: "dry_goods",
    art: "sack",
    packKg: null,
    reorderLevel: 5,
    aliases,
    status: "active",
    onHand: 50,
    reserved: 0,
    available: 50,
    health: "healthy",
  };
}

const catalogue = [
  product("oil", "Cooking oil 18L", "tin", ["cooking oil", "oil"]),
  product("jasmine", "Jasmine rice 5kg", "bag", ["jasmine rice"]),
  product("eggs", "Fresh eggs, 300 pieces", "carton", ["eggs"]),
  product("milk", "Evaporated milk", "tin", []),
];

describe("findPriceProduct", () => {
  it("finds the product a price question names", () => {
    expect(findPriceProduct("cooking oil", catalogue)?.id).toBe("oil");
    expect(findPriceProduct("jasmine rice 5kg", catalogue)?.id).toBe("jasmine");
  });

  it("returns null for an empty query or a product outside the catalogue", () => {
    expect(findPriceProduct("", catalogue)).toBeNull();
    expect(findPriceProduct("wagyu beef", catalogue)).toBeNull();
  });
});

describe("productsNamedIn", () => {
  it("finds products named anywhere in a longer question", () => {
    const named = productsNamedIn("Should I buy more eggs or evaporated milk before the weekend?", catalogue, 5);
    expect(named.map((item) => item.id).sort()).toEqual(["eggs", "milk"]);
  });

  it("respects the limit and only returns catalogue products", () => {
    expect(productsNamedIn("eggs, oil, jasmine rice and milk", catalogue, 2)).toHaveLength(2);
    expect(productsNamedIn("caviar and truffles", catalogue, 5)).toEqual([]);
  });
});
