import { describe, expect, it } from "vitest";
import {
  ASK_COPY,
  availabilityLabel,
  deliveriesText,
  greetingText,
  otherShopsText,
  priceText,
  readLineStatus,
  reliabilityText,
  restockText,
  spendText,
} from "./replies";

describe("Ask copy (BUY-47, BUY-48, BUY-50)", () => {
  it("greets the buyer by first name", () => {
    expect(greetingText("Mei")).toBe(
      "Hi Mei. Type an order the way you'd text a supplier, or ask me about prices, deliveries and spending.",
    );
  });

  it("keeps the fixed copy exact", () => {
    expect(ASK_COPY.fallback).toBe(
      "I did not catch that. Type your order as you would text a supplier, or ask about prices, deliveries or spending.",
    );
    expect(ASK_COPY.unavailable).toBe("Ask is not available right now. You can still order from the Order page.");
    expect(ASK_COPY.readOrder).toBe("Here is what I read. Nothing has been sent.");
  });

  it("names only the buyer's own business for other shops", () => {
    expect(otherShopsText("Mei's Noodle House")).toBe("I can only see orders and prices for Mei's Noodle House.");
  });

  it("states spend under and over budget", () => {
    expect(spendText(61250, 90000)).toBe("You have spent S$612.50 this week, S$287.50 under your S$900.00 budget.");
    expect(spendText(95000, 90000)).toBe("You have spent S$950.00 this week, S$50.00 over your S$900.00 budget.");
  });

  it("counts deliveries and items in plain English", () => {
    expect(deliveriesText(1)).toBe("1 delivery on the way.");
    expect(deliveriesText(3)).toBe("3 deliveries on the way.");
    expect(restockText(1)).toBe("1 item will run out soon.");
    expect(restockText(4)).toBe("4 items will run out soon.");
  });

  it("states price per unit and the best supplier", () => {
    expect(priceText({ name: "Cooking oil 18L", price: "38.50", unit: "tin" })).toBe("Cooking oil 18L is S$38.50 per tin.");
    expect(reliabilityText("Harbour Dry Goods", 96)).toBe("Harbour Dry Goods has your best record, at 96% on time.");
  });

  it("labels availability like the prototype price card", () => {
    expect(availabilityLabel({ status: "unconfirmed", available: 0, health: "unconfirmed" })).toBe("To confirm");
    expect(availabilityLabel({ status: "active", available: 0, health: "out" })).toBe("Out of stock");
    expect(availabilityLabel({ status: "active", available: 3, health: "low" })).toBe("Only 3 left");
    expect(availabilityLabel({ status: "active", available: 40, health: "healthy" })).toBe("40 available");
  });

  it("labels read lines like the prototype", () => {
    expect(readLineStatus("matched")).toBe("Matched");
    expect(readLineStatus("check")).toBe("Check this");
    expect(readLineStatus("not_found")).toBe("Not found");
  });
});
