import { describe, expect, it } from "vitest";
import { activeHrefFor, NAV } from "./nav";

describe("navigation", () => {
  it("lists the buyer's six sections in order, with no Alerts item", () => {
    expect(NAV.buyer.map((item) => item.href)).toEqual([
      "/buyer",
      "/buyer/assistant",
      "/buyer/orders",
      "/buyer/products",
      "/buyer/insights",
      "/buyer/settings",
    ]);
    expect(NAV.supplier.some((item) => item.href.endsWith("/notifications"))).toBe(false);
    expect(NAV.admin.some((item) => item.href === "/admin/notifications")).toBe(true);
  });

  it("highlights the section a page belongs to", () => {
    expect(activeHrefFor("buyer", "/buyer")).toBe("/buyer");
    expect(activeHrefFor("buyer", "/buyer/orders/7d1e")).toBe("/buyer/orders");
    expect(activeHrefFor("admin", "/admin/users/buyers/1")).toBe("/admin/users");
  });

  it("highlights nothing on pages outside the nav, such as the cart and alerts", () => {
    expect(activeHrefFor("buyer", "/buyer/cart")).toBe("");
    expect(activeHrefFor("buyer", "/buyer/notifications")).toBe("");
  });
});
