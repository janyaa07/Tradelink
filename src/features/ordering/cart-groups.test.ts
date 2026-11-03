import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/domain/catalogue";
import { groupCartLines } from "./cart-groups";
import type { DraftLine } from "./draft";

const RICE = "11111111-1111-4111-8111-111111111111";
const OIL = "22222222-2222-4222-8222-222222222222";
const EGGS = "33333333-3333-4333-8333-333333333333";
const GONE = "44444444-4444-4444-8444-444444444444";

function product(id: string, supplierOrgId: string, supplierName: string): CatalogueItem {
  return {
    id,
    supplierOrgId,
    supplierName,
    sku: "SKU",
    name: "Product",
    unit: "bag",
    price: "10.00",
    category: "dry_goods",
    art: "sack",
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

function line(id: string, productId: string | null, state: DraftLine["state"] = "matched"): DraftLine {
  return { id, sourceText: id, productId, qty: 1, kg: null, qtyAssumed: false, options: [], state };
}

const byId = new Map([
  [RICE, product(RICE, "s2", "Harbour Dry Goods")],
  [OIL, product(OIL, "s2", "Harbour Dry Goods")],
  [EGGS, product(EGGS, "s1", "Fresh Lane Produce")],
]);

describe("groupCartLines", () => {
  it("groups lines by supplier, sorted by supplier name, keeping cart order inside a group", () => {
    const groups = groupCartLines([line("a", OIL), line("b", EGGS), line("c", RICE)], byId);
    expect(groups.unresolved).toEqual([]);
    expect(groups.suppliers.map((group) => [group.supplierName, group.lines.map((each) => each.id)])).toEqual([
      ["Fresh Lane Produce", ["b"]],
      ["Harbour Dry Goods", ["a", "c"]],
    ]);
  });

  it("keeps lines with no product, or a product no longer in the catalogue, apart as unresolved", () => {
    const groups = groupCartLines([line("a", null, "check"), line("b", RICE), line("c", GONE), line("d", null, "not_found")], byId);
    expect(groups.unresolved.map((each) => each.id)).toEqual(["a", "c", "d"]);
    expect(groups.suppliers).toHaveLength(1);
    expect(groups.suppliers[0]?.supplierOrgId).toBe("s2");
  });

  it("returns no groups for an empty cart", () => {
    expect(groupCartLines([], byId)).toEqual({ unresolved: [], suppliers: [] });
  });
});
