import { describe, expect, it } from "vitest";
import { orderTotalCents, statsByOrg, summariseOrders, type OrderStatRow } from "./orderStats";

const BUYER = "buyer-1";
const OTHER_BUYER = "buyer-2";
const SUPPLIER = "supplier-1";

function row(status: OrderStatRow["status"], lines: OrderStatRow["lines"], buyerOrgId = BUYER): OrderStatRow {
  return { status, buyerOrgId, supplierOrgId: SUPPLIER, lines };
}

const ROWS: OrderStatRow[] = [
  row("pending", [{ qty: 2, unitPrice: "52.00" }]),
  row("accepted", [{ qty: 3, unitPrice: 9.4 }]),
  row("delivered", [{ qty: 1, unitPrice: "10.10" }, { qty: 2, unitPrice: "0.45" }]),
  row("cancelled", [{ qty: 5, unitPrice: "20.00" }], OTHER_BUYER),
  row("rejected", [{ qty: 1, unitPrice: "99.99" }], OTHER_BUYER),
];

describe("orderTotalCents", () => {
  it("adds line totals in cents without float drift", () => {
    expect(orderTotalCents([{ qty: 3, unitPrice: "0.10" }, { qty: 1, unitPrice: 0.2 }])).toBe(50);
  });
});

describe("summariseOrders", () => {
  it("counts open orders and their value", () => {
    const stats = summariseOrders(ROWS);
    expect(stats.orders).toBe(5);
    expect(stats.open).toBe(2);
    expect(stats.openValueCents).toBe(10400 + 2820);
  });

  it("leaves rejected and cancelled orders out of the order value", () => {
    expect(summariseOrders(ROWS).valueCents).toBe(10400 + 2820 + 1100);
  });

  it("is zero for no orders", () => {
    expect(summariseOrders([])).toEqual({ orders: 0, open: 0, valueCents: 0, openValueCents: 0 });
  });
});

describe("statsByOrg", () => {
  it("counts each order for its buyer and its supplier", () => {
    const byOrg = statsByOrg(ROWS);
    expect(byOrg.get(SUPPLIER)?.orders).toBe(5);
    expect(byOrg.get(BUYER)).toEqual({ orders: 3, open: 2, valueCents: 14320, openValueCents: 13220 });
    expect(byOrg.get(OTHER_BUYER)).toEqual({ orders: 2, open: 0, valueCents: 0, openValueCents: 0 });
  });
});
