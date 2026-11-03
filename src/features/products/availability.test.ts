import { describe, expect, it } from "vitest";
import { MAX_LINE_QTY } from "@/domain/review";
import { availabilityOf, matchesSearch } from "./availability";

describe("availabilityOf", () => {
  it("shows the amount in stock above the reorder level, capped at what is available", () => {
    expect(availabilityOf({ status: "active", available: 40, reorderLevel: 10 })).toEqual({
      label: "40 in stock",
      tone: "good",
      orderable: true,
      limit: 40,
      reason: null,
    });
  });

  it("shows Only {n} left at or below the reorder level", () => {
    expect(availabilityOf({ status: "active", available: 3, reorderLevel: 5 })).toMatchObject({
      label: "Only 3 left",
      tone: "warn",
      orderable: true,
      limit: 3,
    });
    expect(availabilityOf({ status: "active", available: 5, reorderLevel: 5 }).label).toBe("Only 5 left");
  });

  it("shows Out of stock with a reason, and cannot be added", () => {
    expect(availabilityOf({ status: "active", available: 0, reorderLevel: 5 })).toEqual({
      label: "Out of stock",
      tone: "bad",
      orderable: false,
      limit: 0,
      reason: "None left to order right now.",
    });
    expect(availabilityOf({ status: "active", available: -2, reorderLevel: 5 }).label).toBe("Out of stock");
  });

  it("shows Stock to confirm for unconfirmed products, which can still be added", () => {
    expect(availabilityOf({ status: "unconfirmed", available: 0, reorderLevel: 0 })).toEqual({
      label: "Stock to confirm",
      tone: "info",
      orderable: true,
      limit: MAX_LINE_QTY,
      reason: null,
    });
  });
});

describe("matchesSearch", () => {
  const item = { name: "Kampung eggs (30)", supplierName: "Lim Poultry", aliases: ["telur"] };

  it("matches the name, supplier and aliases, ignoring case and spaces", () => {
    expect(matchesSearch(item, "")).toBe(true);
    expect(matchesSearch(item, "  EGGS ")).toBe(true);
    expect(matchesSearch(item, "lim")).toBe(true);
    expect(matchesSearch(item, "telur")).toBe(true);
    expect(matchesSearch(item, "rice")).toBe(false);
  });
});
