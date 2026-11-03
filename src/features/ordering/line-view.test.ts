import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/domain/catalogue";
import type { DraftLine } from "./draft";
import { lineView, type LineContext } from "./line-view";

const RICE = "11111111-1111-4111-8111-111111111111";
const RICE_2 = "22222222-2222-4222-8222-222222222222";

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
    reorderLevel: 2,
    aliases: [],
    status: "active",
    onHand: 10,
    reserved: 2,
    available: 8,
    health: "healthy",
    ...overrides,
  };
}

function line(overrides: Partial<DraftLine> = {}): DraftLine {
  return {
    id: "l1",
    sourceText: "10kg jasmine rice",
    productId: RICE,
    qty: 2,
    kg: 10,
    qtyAssumed: false,
    options: [],
    state: "matched",
    ...overrides,
  };
}

function context(overrides: Partial<LineContext> = {}): LineContext {
  const catalogue = [product(RICE), product(RICE_2, { name: "Fragrant rice 5kg", supplierName: "Bright Pantry", supplierOrgId: "s2", available: 40 })];
  return {
    byId: new Map(catalogue.map((item) => [item.id, item])),
    catalogue,
    over: new Set(),
    invitedSuppliers: new Set(),
    lastPaid: new Map(),
    ...overrides,
  };
}

describe("cart line", () => {
  it("shows the unit price, the line total and the kg conversion, with no pill for a matched line", () => {
    const view = lineView(line(), context());
    expect(view.attention).toBeNull();
    expect(view.unitPrice).toBe("S$12.40 per bag");
    expect(view.totalCents).toBe(2480);
    expect(view.notes).toEqual(["10kg rounded to full bags"]);
  });

  it("explains lines without a product and flags them for attention", () => {
    expect(lineView(line({ productId: null, state: "check" }), context())).toMatchObject({
      attention: { label: "Check this", tone: "warn" },
      border: "warn",
      message: "More than one product fits. Choose the right one.",
      totalCents: null,
      canAddToCatalogue: false,
    });
    expect(lineView(line({ productId: null, state: "not_found" }), context())).toMatchObject({
      border: "bad",
      attention: { label: "Not in catalogue", tone: "bad" },
      canAddToCatalogue: true,
    });
  });

  it("keeps Check this on a line whose product is a guess", () => {
    expect(lineView(line({ state: "check" }), context()).attention).toEqual({ label: "Check this", tone: "warn" });
    expect(lineView(line({ state: "suggested" }), context()).attention).toBeNull();
  });

  it("blocks too much quantity and offers a substitute with stock", () => {
    const view = lineView(line({ qty: 20, kg: null }), context({ over: new Set([RICE]) }));
    expect(view.message).toBe("Only 8 available. Reduce the quantity.");
    expect(view.border).toBe("bad");
    expect(view.substitute?.id).toBe(RICE_2);
  });

  it("marks products still to be confirmed and invited suppliers", () => {
    const pending = product(RICE, { status: "unconfirmed", available: 0 });
    const view = lineView(
      line({ kg: null, qtyAssumed: true, state: "added" }),
      context({ byId: new Map([[RICE, pending]]), invitedSuppliers: new Set(["s1"]) }),
    );
    expect(view.estimated).toBe(true);
    expect(view.notes).toEqual(["Stock to be confirmed", "Waits for the supplier to accept your invitation", "Quantity assumed"]);
  });

  it("warns when the price is more than 2% above the last price paid", () => {
    expect(lineView(line(), context({ lastPaid: new Map([[RICE, "11.90"]]) })).lastPaidNote).toBe("You last paid S$11.90");
    expect(lineView(line(), context({ lastPaid: new Map([[RICE, "12.30"]]) })).lastPaidNote).toBeNull();
  });
});
