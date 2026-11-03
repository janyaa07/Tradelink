import { plural, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, type Cents } from "@/domain/money";
import type { AskReply, ReadLineStatus } from "./types";

/** Fixed Tradelink Assistant copy (BUY-47 to BUY-50, renamed from Ask). */
export const ASK_COPY = {
  fallback: "I did not catch that. Type your order as you would text a supplier, or ask about prices, deliveries or spending.",
  unavailable: "The assistant is not available right now. You can still add products to your cart from Products.",
  orderNotFound: "I cannot find that order on your account.",
  nothingOnTheWay: "Nothing is on the way right now.",
  enoughStock: "You have enough stock for the next few days.",
  productNotFound: "I could not find that product in the catalogue.",
  usual: "Here are your usual items.",
  noUsuals: "You have no usual items yet. Add them in Settings.",
  enoughStockUsual: "You have enough stock for the next few days. Here are your usual items.",
  readOrder: "Here is what I read. Nothing has been sent.",
  noSupplierRecord: "None of your suppliers has delivered an order yet, so there is no on-time record to compare.",
  rateLimited: "Too many requests. Try again in a few minutes.",
  invalidInput: "Check the details and try again.",
  cartEmpty: "Your cart is empty. Tell me what you need and I will add it.",
  cartChanged: "Your cart changed. Ask again or open your cart.",
  cartNeedsReview: "Some items in your cart need checking first. Open your cart to fix them.",
  stockShort: "Some items do not have enough stock now. Open your cart to change them.",
} as const;

export function textReply(text: string): AskReply {
  return { text, cards: [], actions: [] };
}

/** The empty chat's greeting, in two lines: "Hi Mei" and the question. */
export function greetingText(firstName: string): { hello: string; ask: string } {
  return { hello: `Hi ${firstName}`, ask: "What do you need today?" };
}

/** The chat's confirmation after Add to cart. */
export function addedToCartText(count: number): string {
  return `Added ${plural(count, "item")} to your cart.`;
}

function supplierCount(count: number): string {
  return count === 1 ? "1 supplier" : `${count} suppliers`;
}

/** "Your cart has 5 items from 2 suppliers, S$123.40 in total." */
export function cartText(itemCount: number, suppliers: number, totalCents: Cents): string {
  if (suppliers === 0) return `Your cart has ${plural(itemCount, "item")}.`;
  return `Your cart has ${plural(itemCount, "item")} from ${supplierCount(suppliers)}, ${formatMoney(totalCents)} in total.`;
}

/** What stops the cart being placed from chat, one sentence each. */
export function cartBlockerText(unresolved: number, over: number): string {
  const parts = [
    unresolved > 0 ? `${plural(unresolved, "item")} ${unresolved === 1 ? "needs" : "need"} a product chosen` : null,
    over > 0 ? `${plural(over, "item")} ${over === 1 ? "is" : "are"} above the stock available` : null,
  ].filter((part): part is string => part !== null);
  return `${parts.join(" and ")}. Open your cart to fix ${unresolved + over === 1 ? "it" : "them"} before placing.`;
}

/** The button under a cart reply: "Place order" or "Place 2 orders". */
export function placeCartLabel(orders: number): string {
  return orders === 1 ? "Place order" : `Place ${orders} orders`;
}

export function cartReadyText(orders: number): string {
  return `Nothing is sent until you tap ${placeCartLabel(orders)}${orders > 1 ? ", one order per supplier" : ""}.`;
}

/** "2 orders placed and stock reserved: ORD-1070 to Harbour Dry Goods, ORD-1071 to Fresh Lane Produce." */
export function placedText(orders: { number: string; supplierName: string }[]): string {
  const list = orders.map((order) => `${order.number} to ${order.supplierName}`).join(", ");
  return `${plural(orders.length, "order")} placed and stock reserved: ${list}.`;
}

export function otherShopsText(businessName: string): string {
  return `I can only see orders and prices for ${businessName}.`;
}

export function orderFoundText(orderNumber: string): string {
  return `Here is ${orderNumber}.`;
}

export function spendText(spentCents: Cents, budgetCents: Cents): string {
  const difference =
    spentCents > budgetCents
      ? `${formatMoney(spentCents - budgetCents)} over`
      : `${formatMoney(budgetCents - spentCents)} under`;
  return `You have spent ${formatMoney(spentCents)} this week, ${difference} your ${formatMoney(budgetCents)} budget.`;
}

export function deliveriesText(count: number): string {
  return `${count === 1 ? "1 delivery" : `${count} deliveries`} on the way.`;
}

export function reorderText(count: number): string {
  return `${count === 1 ? "1 item" : `${count} items`} will run out soon.`;
}

export function priceText(item: Pick<CatalogueItem, "name" | "price" | "unit">): string {
  return `${item.name} is ${formatMoney(item.price)} per ${item.unit}.`;
}

export function reliabilityText(supplierName: string, percent: number): string {
  return `${supplierName} has your best record, at ${percent}% on time.`;
}

/** "S$38.50 per tin". */
export function unitPriceLabel(item: Pick<CatalogueItem, "price" | "unit">): string {
  return `${formatMoney(item.price)} per ${item.unit}`;
}

/** The prototype's price card availability: "To confirm", "Out of stock", "Only {n} left" or "{n} available". */
export function availabilityLabel(item: Pick<CatalogueItem, "status" | "available" | "health">): string {
  if (item.status === "unconfirmed") return "To confirm";
  if (item.available <= 0) return "Out of stock";
  if (item.health === "low") return `Only ${item.available} left`;
  return `${item.available} available`;
}

/** The prototype's labels for a read line; any state other than matched or not found needs a check. */
export function readLineStatus(state: string): ReadLineStatus {
  if (state === "matched") return "Matched";
  if (state === "not_found") return "Not found";
  return "Check this";
}
