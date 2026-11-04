import { describe, expect, it } from "vitest";
import {
  deliveryDateOf,
  deliveryLabel,
  inOrderTab,
  linesSummary,
  matchesBuyer,
  parseOrderTab,
  parseSupplierSearch,
  restLabel,
  supplierOrdersHref,
} from "./orderFilters";

describe("parseOrderTab", () => {
  it("defaults to All", () => {
    expect(parseOrderTab("to_pack")).toBe("to_pack");
    expect(parseOrderTab("")).toBe("all");
    expect(parseOrderTab("everything")).toBe("all");
  });
});

describe("inOrderTab", () => {
  it("matches each tab's statuses, and All matches every order", () => {
    expect(inOrderTab({ status: "pending" }, "new")).toBe(true);
    expect(inOrderTab({ status: "accepted" }, "new")).toBe(false);
    expect(inOrderTab({ status: "accepted" }, "to_pack")).toBe(true);
    expect(inOrderTab({ status: "cancelled" }, "all")).toBe(true);
  });
});

describe("parseSupplierSearch", () => {
  it("reads an order number with or without ORD-", () => {
    expect(parseSupplierSearch("1066")).toEqual({ kind: "number", number: 1066 });
    expect(parseSupplierSearch(" ord-1066 ")).toEqual({ kind: "number", number: 1066 });
  });

  it("treats anything else as part of a buyer's name", () => {
    expect(parseSupplierSearch("Golden Crust")).toEqual({ kind: "buyer", text: "golden crust" });
    expect(parseSupplierSearch("  ")).toBeNull();
  });

  it("matches buyer names ignoring case", () => {
    expect(matchesBuyer({ buyer: { id: "b", name: "Golden Crust Bakery" } }, "crust")).toBe(true);
    expect(matchesBuyer({ buyer: { id: "b", name: "Lotus Leaf" } }, "crust")).toBe(false);
  });
});

describe("supplierOrdersHref", () => {
  it("leaves out the default tab and an empty search", () => {
    expect(supplierOrdersHref({})).toBe("/supplier/orders");
    expect(supplierOrdersHref({ tab: "to_pack", q: " lotus " })).toBe("/supplier/orders?filter=to_pack&q=lotus");
  });
});

describe("delivery", () => {
  it("prefers the confirmed date", () => {
    expect(deliveryDateOf({ confirmedDeliveryDate: "2026-11-05", requestedDeliveryDate: "2026-11-04" })).toBe("2026-11-05");
    expect(deliveryDateOf({ confirmedDeliveryDate: null, requestedDeliveryDate: null })).toBeNull();
  });

  it("names today and tomorrow", () => {
    expect(deliveryLabel("2026-11-04", "2026-11-04")).toBe("Today");
    expect(deliveryLabel("2026-11-05", "2026-11-04")).toBe("Tomorrow");
    expect(deliveryLabel("2026-11-06", "2026-11-04")).toBe("Fri 6 Nov");
    expect(deliveryLabel(null, "2026-11-04")).toBe("—");
  });
});

describe("linesSummary", () => {
  it("lists quantity and name", () => {
    expect(
      linesSummary([
        { qty: 12, name: "Coconut milk" },
        { qty: 4, name: "Ginger" },
      ]),
    ).toBe("12 × Coconut milk, 4 × Ginger");
  });
});

describe("restLabel", () => {
  it("names the rest's date until it arrives", () => {
    expect(restLabel({ later: { date: "2026-11-09", status: "waiting" } })).toBe("Rest on Mon 9 Nov");
    expect(restLabel({ later: { date: "2026-11-09", status: "out_for_delivery" } })).toBe("Rest on Mon 9 Nov");
  });

  it("is empty when there is no rest to come", () => {
    expect(restLabel({ later: null })).toBeNull();
    expect(restLabel({ later: { date: "2026-11-09", status: "delivered" } })).toBeNull();
    expect(restLabel({ later: { date: "2026-11-09", status: "cancelled" } })).toBeNull();
  });
});
