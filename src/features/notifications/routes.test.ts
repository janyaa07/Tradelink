import { describe, expect, it } from "vitest";
import { routeFor, toneOf } from "./routes";

describe("notification links", () => {
  it("opens the order page for buyers and the orders list for other roles", () => {
    expect(routeFor("buyer", "/orders/5f0c")).toBe("/buyer/orders/5f0c");
    expect(routeFor("supplier", "/orders/5f0c")).toBe("/supplier/orders/5f0c");
    expect(routeFor("buyer", "/issues/9a")).toBe("/buyer/orders");
  });

  it("keeps admin-only pages for admins and sends others home", () => {
    expect(routeFor("admin", "/suppliers/s1")).toBe("/admin/suppliers/s1");
    expect(routeFor("buyer", "/suppliers/s1")).toBe("/buyer");
    expect(routeFor("supplier", "/inventory")).toBe("/supplier/inventory");
  });

  it("names a tone for each kind", () => {
    expect(toneOf("Order rejected")).toBe("bad");
    expect(toneOf("Order delivered")).toBe("good");
    expect(toneOf("New order")).toBe("info");
  });
});
