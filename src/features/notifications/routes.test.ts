import { describe, expect, it } from "vitest";
import { actionFor, routeFor, toneOf } from "./routes";

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

describe("what each notification asks for", () => {
  it("names the button and opens the right part of the order", () => {
    expect(actionFor("supplier", { kind: "Message", title: "Mei's Noodle House about ORD-1039" })).toEqual({ label: "Reply", hash: "#messages" });
    expect(actionFor("buyer", { kind: "Date change", title: "Island Spice Traders asks to move ORD-1085" })).toEqual({
      label: "Answer",
      hash: "#messages",
    });
    expect(actionFor("supplier", { kind: "Date change", title: "Seaside Kopitiam declined: ORD-1085" }).label).toBe("View order");
    expect(actionFor("supplier", { kind: "New order", title: "ORD-1088 from Mei's Noodle House" }).label).toBe("Review order");
    expect(actionFor("buyer", { kind: "Order accepted", title: "ORD-1088 accepted" }).label).toBe("Open");
  });
});
