import { describe, expect, it } from "vitest";
import {
  addedToCartText,
  ASK_COPY,
  availabilityLabel,
  cartBlockerText,
  cartReadyText,
  cartText,
  deliveriesText,
  greetingText,
  otherShopsText,
  placeCartLabel,
  placedText,
  priceText,
  readLineStatus,
  reliabilityText,
  restockText,
  spendText,
  unitPriceLabel,
} from "./replies";

describe("Tradelink Assistant copy (BUY-47, BUY-48, BUY-50)", () => {
  it("greets the buyer by first name", () => {
    expect(greetingText("Mei")).toEqual({ hello: "Hi Mei", ask: "What do you need today?" });
  });

  it("keeps the fixed copy exact", () => {
    expect(ASK_COPY.fallback).toBe(
      "I did not catch that. Type your order as you would text a supplier, or ask about prices, deliveries or spending.",
    );
    expect(ASK_COPY.unavailable).toBe(
      "The assistant is not available right now. You can still add products to your cart from Products.",
    );
    expect(ASK_COPY.readOrder).toBe("Here is what I read. Nothing has been sent.");
  });

  it("confirms what Add to cart added", () => {
    expect(addedToCartText(1)).toBe("Added 1 item to your cart.");
    expect(addedToCartText(3)).toBe("Added 3 items to your cart.");
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
    expect(unitPriceLabel({ price: "38.50", unit: "tin" })).toBe("S$38.50 per tin");
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


describe("Tradelink Assistant cart copy", () => {
  it("sums up the cart", () => {
    expect(cartText(5, 2, 12340)).toBe("Your cart has 5 items from 2 suppliers, S$123.40 in total.");
    expect(cartText(1, 1, 5200)).toBe("Your cart has 1 item from 1 supplier, S$52.00 in total.");
    expect(cartText(2, 0, 0)).toBe("Your cart has 2 items.");
  });

  it("says what blocks placing from chat", () => {
    expect(cartBlockerText(1, 0)).toBe("1 item needs a product chosen. Open your cart to fix it before placing.");
    expect(cartBlockerText(2, 1)).toBe(
      "2 items need a product chosen and 1 item is above the stock available. Open your cart to fix them before placing.",
    );
  });

  it("names the place button by the number of orders", () => {
    expect(placeCartLabel(1)).toBe("Place order");
    expect(placeCartLabel(2)).toBe("Place 2 orders");
    expect(cartReadyText(1)).toBe("Nothing is sent until you tap Place order.");
    expect(cartReadyText(3)).toBe("Nothing is sent until you tap Place 3 orders, one order per supplier.");
  });

  it("lists the placed orders", () => {
    expect(
      placedText([
        { number: "ORD-1070", supplierName: "Harbour Dry Goods" },
        { number: "ORD-1071", supplierName: "Fresh Lane Produce" },
      ]),
    ).toBe("2 orders placed and stock reserved: ORD-1070 to Harbour Dry Goods, ORD-1071 to Fresh Lane Produce.");
  });
});
