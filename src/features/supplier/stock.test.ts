import { describe, expect, it } from "vitest";
import {
  filterInventory,
  inventoryHref,
  movementReason,
  movementSource,
  movementUnits,
  needsReorder,
  parseInventoryFilter,
  parseMovementType,
  signedUnits,
  stockBarPercent,
  stockHistoryHref,
} from "./stock";

describe("stockBarPercent", () => {
  it("measures available stock against twice the reorder level", () => {
    expect(stockBarPercent({ status: "active", available: 5, reorderLevel: 5 })).toBe(50);
    expect(stockBarPercent({ status: "active", available: 40, reorderLevel: 5 })).toBe(100);
  });

  it("keeps a sliver for empty stock and never divides by zero", () => {
    expect(stockBarPercent({ status: "active", available: 0, reorderLevel: 5 })).toBe(3);
    expect(stockBarPercent({ status: "active", available: -2, reorderLevel: 5 })).toBe(3);
    expect(stockBarPercent({ status: "active", available: 1, reorderLevel: 0 })).toBe(100);
  });

  it("has no bar for unconfirmed products", () => {
    expect(stockBarPercent({ status: "unconfirmed", available: 0, reorderLevel: 5 })).toBeNull();
  });
});

describe("filterInventory", () => {
  const items = [
    { name: "Eggs (tray of 30)", sku: "FL-1001", health: "healthy" as const },
    { name: "Jasmine rice 10kg", sku: "HD-1002", health: "low" as const },
    { name: "Tofu", sku: "NEW-1014", health: "unconfirmed" as const },
    { name: "Cooking oil 2L", sku: "HD-1003", health: "out" as const },
  ];

  it("searches name and SKU, ignoring case", () => {
    expect(filterInventory(items, "RICE", "all").map((item) => item.sku)).toEqual(["HD-1002"]);
    expect(filterInventory(items, "hd-", "all")).toHaveLength(2);
  });

  it("keeps low, out or buyer-added products", () => {
    expect(filterInventory(items, "", "low").map((item) => item.sku)).toEqual(["HD-1002"]);
    expect(filterInventory(items, "", "out").map((item) => item.sku)).toEqual(["HD-1003"]);
    expect(filterInventory(items, "", "confirm").map((item) => item.sku)).toEqual(["NEW-1014"]);
    expect(filterInventory(items, "oil", "low")).toHaveLength(0);
  });

  it("counts low and out of stock as needing a reorder", () => {
    expect(needsReorder({ health: "out" })).toBe(true);
    expect(needsReorder({ health: "unconfirmed" })).toBe(false);
  });

  it("reads the filter, defaulting to All", () => {
    expect(parseInventoryFilter("confirm")).toBe("confirm");
    expect(parseInventoryFilter("1")).toBe("all");
  });
});

describe("movements", () => {
  it("counts reserved units for reservations and units on hand otherwise", () => {
    expect(movementUnits({ type: "reserved", onHandChange: 0, reservedChange: 6 })).toBe(6);
    expect(movementUnits({ type: "released", onHandChange: 0, reservedChange: -6 })).toBe(-6);
    expect(movementUnits({ type: "delivered", onHandChange: -6, reservedChange: -6 })).toBe(-6);
    expect(movementUnits({ type: "adjusted", onHandChange: -2, reservedChange: 0 })).toBe(-2);
  });

  it("signs units", () => {
    expect(signedUnits(30)).toBe("+30");
    expect(signedUnits(-4)).toBe("-4");
  });

  it("names the reason for adjustments", () => {
    expect(movementSource({ type: "adjusted", reason: "count_correction", source: "Ahmad Tan" })).toBe("Ahmad Tan, count correction");
    expect(movementSource({ type: "received", reason: "opening_stock", source: "Opening stock" })).toBe("Opening stock");
    expect(movementSource({ type: "reserved", reason: null, source: "ORD-1044" })).toBe("ORD-1044");
  });

  it("gives a reason only for adjustments", () => {
    expect(movementReason({ type: "adjusted", reason: "damaged" })).toBe("Damaged");
    expect(movementReason({ type: "received", reason: "opening_stock" })).toBeNull();
  });

  it("links to one kind of change", () => {
    expect(parseMovementType("adjusted")).toBe("adjusted");
    expect(parseMovementType("all")).toBeNull();
    expect(stockHistoryHref("received")).toBe("/supplier/stock-history?type=received");
    expect(stockHistoryHref(null)).toBe("/supplier/stock-history");
  });
});

describe("inventoryHref", () => {
  it("keeps only the parts of the view that are set", () => {
    expect(inventoryHref({})).toBe("/supplier/inventory");
    expect(inventoryHref({ q: " rice ", filter: "low" })).toBe("/supplier/inventory?q=rice&filter=low");
    expect(inventoryHref({ q: "eggs & tofu", add: true })).toBe("/supplier/inventory?q=eggs+%26+tofu&add=1");
  });
});
