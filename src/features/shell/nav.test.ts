import { describe, expect, it } from "vitest";
import { activeHrefFor, NAV } from "./nav";

describe("navigation", () => {
  it("lists the buyer's five sections in order, with no Alerts or Settings item", () => {
    expect(NAV.buyer.map((item) => item.href)).toEqual([
      "/buyer",
      "/buyer/assistant",
      "/buyer/orders",
      "/buyer/products",
      "/buyer/insights",
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
    expect(activeHrefFor("buyer", "/buyer/settings")).toBe("");
  });
});
