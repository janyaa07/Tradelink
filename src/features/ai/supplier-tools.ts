import "server-only";
import { z } from "zod";
import { getCatalogue } from "@/data/catalogue";
import { callRpc } from "@/data/rpc";
import { plural } from "@/domain/catalogue";
import type { AiCard } from "@/domain/ask/types";
import { formatMoney, toCents } from "@/domain/money";
import { getOrders } from "@/features/orders/queries";
import { ISSUE_ANSWERS } from "@/features/supplier/issues";
import { getBusinessProfile, getOpenIssues } from "@/features/supplier/queries";
import { formatDate, orderNumber } from "@/ui/format";
import { orderCard, stockCard, tag } from "./cards";
import { readTool, writeTool, type AiTool } from "./registry";
import { deliveryDay, findOrder, NOT_FOUND, orderFacts, orderNumberInput } from "./shared";

const SUPPLIER_FILTERS = {
  new: { statuses: ["pending" as const] },
  accepted: { statuses: ["accepted" as const] },
  out_for_delivery: { statuses: ["out_for_delivery" as const] },
  delivered: { statuses: ["delivered" as const] },
  all: {},
};

const ANSWER_WORDS: Record<(typeof ISSUE_ANSWERS)[number], string> = {
  credit: "Credit the buyer",
  replace: "Replace on the next delivery",
  on_the_way: "Tell the buyer it is on the way",
  dispute: "Dispute it",
};

async function ownProduct(productId: string) {
  return (await getCatalogue()).find((item) => item.id === productId) ?? null;
}

/** Accept needs a date; the rest are one database function each on a single order. */
function orderStep(name: string, rpc: string, description: string, title: string, label: string, done: string, allowed: string[]): AiTool {
  return writeTool({
    name,
    description,
    input: z.object({ order_number: orderNumberInput }),
    propose: async (_ctx, { order_number }) => {
      const order = await findOrder(order_number);
      if (!order) return NOT_FOUND;
      if (!allowed.includes(order.status)) return { error: `${orderNumber(order.number)} is ${order.status.replace(/_/g, " ")}, so this is not possible.` };
      return {
        title: `${title} ${orderNumber(order.number)}`,
        details: [`${order.buyer.name} · ${formatMoney(order.totalCents)}`, ...order.lines.map((line) => `${line.qty} × ${line.name}`)],
        confirmLabel: label,
        args: { order_number, order_id: order.id },
      };
    },
    exec: async (_ctx, args, key) => {
      const result = await callRpc(rpc, { p_order: String((args as { order_id?: string }).order_id), p_key: key });
      return result.ok ? { ok: true, data: done } : result;
    },
  });
}

export const SUPPLIER_TOOLS: AiTool[] = [
  readTool({
    name: "list_orders",
    description:
      "Orders from the supplier's buyers, newest first. filter: new (waiting for accept or reject), accepted, out_for_delivery, delivered or all. delivery_on narrows to one delivery day: 'today', 'tomorrow' or YYYY-MM-DD. Use it whenever the person names a day.",
    input: z.object({
      filter: z.enum(["new", "accepted", "out_for_delivery", "delivered", "all"]),
      delivery_on: z.string().regex(/^(today|tomorrow|\d{4}-\d{2}-\d{2})$/).optional(),
      limit: z.number().int().min(1).max(20).default(8),
    }),
    run: async (ctx, { filter, delivery_on, limit }) => {
      const day = deliveryDay(delivery_on, ctx.now);
      const orders = (await getOrders({ supplierOrgId: ctx.session.orgId, ...SUPPLIER_FILTERS[filter], limit: day ? 60 : limit }))
        .filter((order) => !day || (order.confirmedDeliveryDate ?? order.requestedDeliveryDate) === day)
        .slice(0, limit);
      const cards = orders.map((order) => orderCard(order, "supplier"));
      return { data: orders.map((order, index) => ({ card: cards[index] ? tag(cards[index]) : null, ...orderFacts(order) })), cards };
    },
  }),
  readTool({
    name: "get_order",
    description: "One order by number, with every line.",
    input: z.object({ order_number: orderNumberInput }),
    run: async (_ctx, { order_number }) => {
      const order = await findOrder(order_number);
      if (!order) return { data: NOT_FOUND };
      const card = orderCard(order, "supplier");
      return { data: { card: tag(card), ...orderFacts(order) }, cards: [card] };
    },
  }),
  readTool({
    name: "get_inventory",
    description:
      "The supplier's products with price, stock on hand, reserved, available and reorder level, each with a card tag (the card has Receive stock and Change price). Optional search words; low_only for items at or below their reorder level.",
    input: z.object({ query: z.string().max(80).optional(), low_only: z.boolean().default(false) }),
    run: async (ctx, { query, low_only }) => {
      const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const items = (await getCatalogue())
        .filter((item) => words.every((word) => `${item.name} ${item.sku}`.toLowerCase().includes(word)))
        .filter((item) => !low_only || item.health === "low" || item.health === "out")
        .slice(0, 30);
      const cards = items.map((item) => stockCard(item, ctx.cardKey("S")));
      return {
        data: items.map((item, index) => ({
          card: cards[index] ? tag(cards[index]) : null,
          product_id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          price: formatMoney(item.price),
          on_hand: item.onHand,
          reserved: item.reserved,
          available: item.available,
          reorder_level: item.reorderLevel,
          health: item.health,
        })),
        cards,
      };
    },
  }),
  readTool({
    name: "get_problems",
    description: "Open problems buyers reported on the supplier's deliveries, with issue_id and a card tag (the card has the four answers).",
    input: z.object({}),
    run: async (ctx) => {
      const issues = await getOpenIssues(ctx.session.orgId);
      const cards: AiCard[] = issues.map((issue) => ({
        kind: "ai_problem",
        key: ctx.cardKey("PR"),
        problem: {
          id: issue.id,
          orderNumber: issue.orderNumber,
          buyer: issue.buyerName,
          item: issue.productName ?? "Item",
          type: issue.type,
          qty: issue.qty,
          amountCents: toCents(issue.amount),
          note: issue.note,
        },
      }));
      return {
        data: issues.map((issue, index) => ({
          card: cards[index] ? tag(cards[index]) : null,
          issue_id: issue.id,
          order: orderNumber(issue.orderNumber),
          buyer: issue.buyerName,
          item: issue.productName,
          type: issue.type,
          qty: issue.qty,
          amount: formatMoney(issue.amount),
          note: issue.note,
        })),
        cards,
      };
    },
  }),
  readTool({
    name: "get_business_profile",
    description: "The supplier's own terms: cut-off, delivery days, lead time and minimum order.",
    input: z.object({}),
    run: async (ctx) => ({ data: await getBusinessProfile(ctx.session.orgId) }),
  }),

  writeTool({
    name: "accept_order",
    description: "Accept a new order for a delivery date (YYYY-MM-DD, Singapore time).",
    input: z.object({ order_number: orderNumberInput, delivery_date: z.iso.date() }),
    propose: async (_ctx, { order_number, delivery_date }) => {
      const order = await findOrder(order_number);
      if (!order) return NOT_FOUND;
      if (order.status !== "pending") return { error: `${orderNumber(order.number)} is already ${order.status.replace(/_/g, " ")}.` };
      return {
        title: `Accept ${orderNumber(order.number)} for ${delivery_date}`,
        details: [`${order.buyer.name} · ${formatMoney(order.totalCents)}`, ...order.lines.map((line) => `${line.qty} × ${line.name}`)],
        confirmLabel: "Accept order",
        args: { order_number, delivery_date, order_id: order.id },
      };
    },
    exec: async (_ctx, args, key) => {
      const result = await callRpc("accept_order", { p_order: String((args as { order_id?: string }).order_id), p_date: args.delivery_date, p_key: key });
      return result.ok ? { ok: true, data: `Accepted for ${formatDate(args.delivery_date)}. The buyer has been told.` } : result;
    },
  }),
  orderStep("reject_order", "reject_order", "Reject a new order.", "Reject", "Reject order", "Order rejected and the buyer told.", ["pending"]),
  orderStep("mark_out_for_delivery", "mark_out_for_delivery", "Mark an accepted order as out for delivery.", "Send out", "Out for delivery", "Marked out for delivery.", ["accepted"]),
  orderStep("mark_delivered", "mark_delivered", "Mark an order as delivered.", "Mark delivered", "Mark delivered", "Marked delivered.", ["accepted", "out_for_delivery"]),
  writeTool({
    name: "answer_problem",
    description: "Answer a buyer's problem: credit, replace, on_the_way or dispute. Use issue_id from get_problems.",
    input: z.object({ issue_id: z.uuid(), answer: z.enum(ISSUE_ANSWERS) }),
    propose: async (ctx, { issue_id, answer }) => {
      const issue = (await getOpenIssues(ctx.session.orgId)).find((entry) => entry.id === issue_id);
      if (!issue) return { error: "That problem is not open." };
      return {
        title: `${ANSWER_WORDS[answer]} · ${orderNumber(issue.orderNumber)}`,
        details: [`${issue.buyerName}: ${issue.qty} × ${issue.productName ?? "item"} (${issue.type.replace(/_/g, " ")}), ${formatMoney(issue.amount)}`],
        confirmLabel: "Send answer",
        args: { issue_id, answer },
      };
    },
    exec: async (_ctx, { issue_id, answer }, key) => {
      const result = await callRpc("answer_issue", { p_issue: issue_id, p_answer: answer, p_key: key });
      return result.ok ? { ok: true, data: "Answer sent to the buyer." } : result;
    },
  }),
  writeTool({
    name: "receive_stock",
    description: "Add received stock to a product. Use product_id from get_inventory.",
    input: z.object({ product_id: z.uuid(), qty: z.number().int().min(1).max(99999) }),
    propose: async (_ctx, { product_id, qty }) => {
      const item = await ownProduct(product_id);
      if (!item) return { error: "That product is not in your inventory." };
      return {
        title: `Add ${plural(qty, item.unit)} of ${item.name} to stock`,
        details: [`On hand now ${item.onHand}, after ${item.onHand + qty}`],
        confirmLabel: "Add stock",
        args: { product_id, qty },
      };
    },
    exec: async (_ctx, { product_id, qty }, key) => {
      const result = await callRpc("receive_stock", { p_product: product_id, p_qty: qty, p_key: key });
      return result.ok ? { ok: true, data: "Stock added." } : result;
    },
  }),
  writeTool({
    name: "change_price",
    description: "Change a product's price in Singapore dollars. Buyers with it as a usual item get a price alert.",
    input: z.object({ product_id: z.uuid(), price: z.number().gt(0).max(99999) }),
    propose: async (_ctx, { product_id, price }) => {
      const item = await ownProduct(product_id);
      if (!item) return { error: "That product is not in your inventory." };
      return {
        title: `Change ${item.name} to ${formatMoney(Math.round(price * 100))} per ${item.unit}`,
        details: [`It is ${formatMoney(item.price)} now.`],
        confirmLabel: "Change price",
        args: { product_id, price },
      };
    },
    exec: async (_ctx, { product_id, price }, key) => {
      const result = await callRpc("change_price", { p_product: product_id, p_price: Math.round(price * 100) / 100, p_key: key });
      return result.ok ? { ok: true, data: "Price changed." } : result;
    },
  }),
];
