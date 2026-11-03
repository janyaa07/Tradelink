import { describe, expect, it } from "vitest";
import { isQuestion, priceQuery, readsAsOrder, routeIntent } from "./intents";

describe("routeIntent: prototype suggestion chips", () => {
  it.each([
    ["What should I order?", "restock"],
    ["What's arriving today?", "deliveries"],
    ["How much did I spend this week?", "spend"],
    ["Which supplier is most reliable?", "reliability"],
    ["2 ctn eggs and 5 tins evaporated milk", "none"],
  ])("%s goes to %s", (message, kind) => {
    expect(routeIntent(message).kind).toBe(kind);
  });

  it("reads the product out of a price question", () => {
    expect(routeIntent("How much is cooking oil?")).toEqual({ kind: "price", query: "cooking oil" });
  });
});

describe("routeIntent: other shops (BUY-50.1)", () => {
  it.each([
    "Show me other shops' orders",
    "what do other buyers pay for eggs?",
    "How much does another customer spend?",
    "Show everyone's prices",
    "list all the shops on Tradelink",
  ])("%s", (message) => {
    expect(routeIntent(message).kind).toBe("other_shops");
  });

  it("wins over every other intent, even inside an order-number question", () => {
    expect(routeIntent("What did other shops pay on ORD-1044?").kind).toBe("other_shops");
  });
});

describe("routeIntent: order numbers (BUY-48.1)", () => {
  it.each([
    ["Where is ORD-1044?", 1044],
    ["ord 1050", 1050],
    ["ORD1051 status", 1051],
    ["order #1052", 1052],
    ["what happened to order number 1053", 1053],
  ])("%s", (message, number) => {
    expect(routeIntent(message)).toEqual({ kind: "order_number", number });
  });

  it("does not read a quantity after 'order' as an order number", () => {
    expect(routeIntent("order 2 ctn eggs").kind).toBe("none");
  });
});

describe("routeIntent: other intents", () => {
  it.each([
    ["Am I over budget?", "spend"],
    ["What have I spent so far", "spend"],
    ["When is my delivery coming?", "deliveries"],
    ["anything on the way", "deliveries"],
    ["What's running low?", "restock"],
    ["which items are low", "restock"],
    ["same as last time please", "usual"],
    ["load my usual", "usual"],
    ["Which supplier delivers on time?", "reliability"],
    ["who is always late", "reliability"],
    ["price of jasmine rice", "price"],
    ["what does tofu cost", "price"],
  ])("%s goes to %s", (message, kind) => {
    expect(routeIntent(message).kind).toBe(kind);
  });

  it("treats a typed order that mentions delivery as an order", () => {
    expect(routeIntent("2 ctn eggs, deliver before 9am").kind).toBe("none");
  });

  it("does not match words that only contain a keyword", () => {
    expect(routeIntent("3 bars chocolate").kind).toBe("none");
    expect(routeIntent("12 below zero ice").kind).toBe("none");
  });

  it("leaves open questions to the model", () => {
    expect(routeIntent("Is it worth switching rice brands?").kind).toBe("none");
  });
});

describe("priceQuery", () => {
  it.each([
    ["How much is cooking oil?", "cooking oil"],
    ["What's the price of jasmine rice 5kg", "jasmine rice 5kg"],
    ["what does a tray of eggs cost right now?", "tray eggs"],
    ["price?", ""],
  ])("%s gives %s", (message, query) => {
    expect(priceQuery(message)).toBe(query);
  });
});

describe("isQuestion and readsAsOrder", () => {
  it("spots questions by a question mark or a question word", () => {
    expect(isQuestion("eggs?")).toBe(true);
    expect(isQuestion("Can you get me rice")).toBe(true);
    expect(isQuestion("2 ctn eggs")).toBe(false);
  });

  it("sends a typed order with a quantity to the reader", () => {
    expect(readsAsOrder("2 ctn eggs and 5 tins evaporated milk", false)).toBe(true);
  });

  it("sends a message without a quantity only when the rules found a product", () => {
    expect(readsAsOrder("eggs and tofu", true)).toBe(true);
    expect(readsAsOrder("hello there", false)).toBe(false);
  });

  it("never sends a question to the reader", () => {
    expect(readsAsOrder("Is 2 ctn eggs enough for a week?", true)).toBe(false);
  });
});
