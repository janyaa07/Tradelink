import { describe, expect, it } from "vitest";
import { needsCheck, orderQueryFor, ordersHref, parseFilter, parseSearch, shownFrom } from "./filters";

describe("order list filters", () => {
  it("reads the filter parameter and falls back to all", () => {
    expect(parseFilter("to_check")).toBe("to_check");
    expect(parseFilter(["closed", "active"])).toBe("closed");
    expect(parseFilter("everything")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
  });

  it("maps each chip to its order statuses", () => {
    expect(orderQueryFor("all")).toEqual({});
    expect(orderQueryFor("active")).toEqual({ statuses: ["pending", "accepted", "out_for_delivery"] });
    expect(orderQueryFor("to_check")).toEqual({ toCheck: true });
    expect(orderQueryFor("delivered")).toEqual({ statuses: ["delivered"] });
    expect(orderQueryFor("closed")).toEqual({ statuses: ["cancelled", "rejected"] });
  });
});

describe("to check", () => {
  it("covers orders out for delivery, and delivered orders nobody has checked", () => {
    expect(needsCheck({ status: "out_for_delivery", checkStatus: "unchecked" })).toBe(true);
    expect(needsCheck({ status: "delivered", checkStatus: "unchecked" })).toBe(true);
  });

  it("leaves out checked, open and closed orders", () => {
    expect(needsCheck({ status: "delivered", checkStatus: "all_here" })).toBe(false);
    expect(needsCheck({ status: "delivered", checkStatus: "problem" })).toBe(false);
    expect(needsCheck({ status: "pending", checkStatus: "unchecked" })).toBe(false);
    expect(needsCheck({ status: "accepted", checkStatus: "unchecked" })).toBe(false);
    expect(needsCheck({ status: "cancelled", checkStatus: "unchecked" })).toBe(false);
  });
});

describe("search", () => {
  it("reads order numbers in any common form", () => {
    for (const value of ["ORD-1044", "ord 1044", "ord1044", "#1044", " 1044 "]) {
      expect(parseSearch(value)).toEqual({ kind: "number", number: 1044 });
    }
  });

  it("searches supplier names otherwise", () => {
    expect(parseSearch("Harbour")).toEqual({ kind: "supplier", text: "Harbour" });
    expect(parseSearch("  Mei's   Noodle ")).toEqual({ kind: "supplier", text: "Mei's Noodle" });
    expect(parseSearch("ORD-")).toEqual({ kind: "supplier", text: "ORD-" });
  });

  it("drops characters that would change the database filter", () => {
    expect(parseSearch("50%_off*,(x)")).toEqual({ kind: "supplier", text: "50 off x" });
    expect(parseSearch("%%")).toBeNull();
    expect(parseSearch("")).toBeNull();
    expect(parseSearch(undefined)).toBeNull();
  });

  it("caps the length", () => {
    const parsed = parseSearch("a".repeat(200));
    expect(parsed?.kind === "supplier" ? parsed.text.length : 0).toBe(60);
  });
});

describe("paging and links", () => {
  it("shows pages of 20, up to 300", () => {
    expect(shownFrom(undefined)).toBe(20);
    expect(shownFrom("40")).toBe(40);
    expect(shownFrom("45")).toBe(60);
    expect(shownFrom("5")).toBe(20);
    expect(shownFrom("9999")).toBe(300);
    expect(shownFrom("abc")).toBe(20);
  });

  it("keeps the filter and search in links", () => {
    expect(ordersHref({ filter: "all" })).toBe("/buyer/orders");
    expect(ordersHref({ filter: "problems" })).toBe("/buyer/orders?filter=problems");
    expect(ordersHref({ filter: "active", q: "Harbour Dry", show: 40 })).toBe("/buyer/orders?filter=active&q=Harbour+Dry&show=40");
    expect(ordersHref({ filter: "all", show: 20 })).toBe("/buyer/orders");
  });
});
