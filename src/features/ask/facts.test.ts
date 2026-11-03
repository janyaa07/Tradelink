import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/domain/catalogue";
import { buildFacts, type FactSources } from "./facts";

const oil: CatalogueItem = {
  id: "oil",
  supplierOrgId: "s1",
  supplierName: "Harbour Dry Goods",
  sku: "OIL",
  name: "Cooking oil 18L",
  unit: "tin",
  price: "38.50",
  category: "oils_sauces",
  art: "tin",
  packKg: null,
  reorderLevel: 5,
  aliases: ["oil"],
  status: "active",
  onHand: 4,
  reserved: 1,
  available: 3,
  health: "low",
};

const base: FactSources = {
  businessName: "Mei's Noodle House",
  spentCents: 61250,
  budgetCents: 90000,
  openOrders: [],
  plan: [],
  products: [],
  suppliers: [],
};

describe("buildFacts", () => {
  it("always states the business, this week's spend and empty sections", () => {
    expect(buildFacts(base)).toEqual([
      { id: "F1", text: "Business: Mei's Noodle House. Ask can only see this business's orders and prices." },
      {
        id: "F2",
        text: "Spend this week (since Monday, Singapore time): S$612.50 of a S$900.00 weekly budget, S$287.50 left.",
      },
      { id: "F3", text: "Open orders: none." },
      { id: "F4", text: "Ready for tomorrow: no usual items will run out in the next few days." },
      { id: "F5", text: "Supplier record: no delivered orders yet." },
    ]);
  });

  it("describes open orders, the plan, named prices and supplier records", () => {
    const facts = buildFacts({
      ...base,
      spentCents: 95000,
      openOrders: [
        {
          number: 1044,
          status: "out_for_delivery",
          supplierName: "Harbour Dry Goods",
          deliveryDate: "2026-11-04",
          lines: [{ qty: 2, name: "Jasmine rice 5kg" }],
          totalCents: 12000,
        },
      ],
      plan: [{ name: "Fresh eggs", daysLeft: 1.5, qty: 3, unit: "carton" }],
      products: [{ item: oil, lastPaid: "37.00" }],
      suppliers: [{ supplierId: "s1", name: "Harbour Dry Goods", delivered: 4, onTime: 3, percent: 75 }],
    }).map((fact) => fact.text);

    expect(facts).toEqual([
      "Business: Mei's Noodle House. Ask can only see this business's orders and prices.",
      "Spend this week (since Monday, Singapore time): S$950.00 of a S$900.00 weekly budget, S$50.00 over budget.",
      "Open order ORD-1044 from Harbour Dry Goods: Out for delivery, delivery Wed 4 Nov, total S$120.00. Items: 2 × Jasmine rice 5kg.",
      "Running low: Fresh eggs, 1.5 days left; suggested order 3 cartons.",
      "Price: Cooking oil 18L from Harbour Dry Goods is S$38.50 per tin. Availability: Only 3 left. You last paid S$37.00.",
      "Supplier record: Harbour Dry Goods delivered 3 of 4 delivered orders on time (75% on time).",
    ]);
  });
});
