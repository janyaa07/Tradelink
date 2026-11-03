import "server-only";
import { z } from "zod";
import { getCatalogue } from "@/data/catalogue";
import { callRpc } from "@/data/rpc";
import { CATEGORIES, plural, UNITS } from "@/domain/catalogue";
import type { AiCard } from "@/domain/ask/types";
import { formatMoney, toCents } from "@/domain/money";
import { getOrders } from "@/features/orders/queries";
import { ISSUE_ANSWERS } from "@/features/supplier/issues";
import { getBusinessProfile, getOpenIssues } from "@/features/supplier/queries";
import { weekdayName } from "@/domain/singapore-time";
import { formatDate, orderNumber } from "@/ui/format";
import { orderCard, stockCard, tag } from "./cards";
import { cardTool, readTool, writeTool, type AiTool, type ExecResult } from "./registry";
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

/** A stock card for something just added, so the card says so. */
function freshStock(card: AiCard): AiCard {
  return card.kind === "ai_stock" ? { ...card, stock: { ...card.stock, added: true } } : card;
}

const ADJUST_REASONS = ["damaged", "expired", "count_correction"] as const;
const REASON_WORDS: Record<(typeof ADJUST_REASONS)[number], string> = { damaged: "damaged", expired: "expired", count_correction: "count correction" };
const dayList = (days: number[]) => days.map((day) => weekdayName(day).slice(0, 3)).join(", ");

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
      "The supplier's products with price, stock on hand, reserved, available and reorder level, each with a card tag (the card has Receive stock, Change price and Adjust; products a buyer added show health unconfirmed and a Confirm price and stock button). Optional search words; low_only for items at or below their reorder level.",
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
    name: "new_product_form",
    description:
      "Show a form card to add a new product to the supplier's catalogue, filled in from the request: name, unit, price, category, opening stock and reorder level. The person checks it and taps Add product.",
    input: z.object({
      name: z.string().trim().min(2).max(80),
      unit: z.enum(UNITS).optional().describe("Best guess from the product, such as bag for rice or dal, bottle for oil"),
      price: z.number().gt(0).max(99999).optional().describe("Only a price the person gave"),
      category: z.enum(CATEGORIES).optional().describe("Best guess from the name"),
      opening: z.number().int().min(0).max(99999).optional(),
      reorder: z.number().int().min(0).max(9999).optional(),
    }),
    run: async (ctx, input) => {
      const similar = (await getCatalogue()).filter((item) => item.name.toLowerCase().includes(input.name.toLowerCase())).slice(0, 3);
      const card: AiCard = {
        kind: "ai_new_product",
        key: ctx.cardKey("NEW"),
        view: "supplier",
        form: {
          name: input.name,
          unit: input.unit ?? null,
          priceCents: input.price ? toCents(input.price) : null,
          suppliers: [],
          supplierId: null,
          newSupplier: null,
          category: input.category ?? null,
          opening: input.opening ?? 0,
          reorder: input.reorder ?? 5,
        },
      };
      return {
        data: {
          card: tag(card),
          filled_in: card.form,
          similar_in_inventory: similar.map((item) => `${item.name} (${item.sku})`),
          note: "Nothing is added until they tap Add product on the card.",
        },
        cards: [card],
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
    name: "update_terms",
    description:
      "Change the supplier's terms: order cut-off time (HH:MM, Singapore), delivery days (1 is Monday to 7 Sunday), lead time in days and minimum order in Singapore dollars. Pass only what changes.",
    input: z.object({
      cutoff: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      delivery_days: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
      lead_days: z.number().int().min(0).max(14).optional(),
      minimum: z.number().min(0).max(99999).optional(),
    }),
    propose: async (ctx, input) => {
      const now = await getBusinessProfile(ctx.session.orgId);
      const details = [
        input.cutoff ? `Cut-off ${now.cutoff.slice(0, 5)} to ${input.cutoff}` : null,
        input.delivery_days ? `Delivery days ${dayList(now.days)} to ${dayList([...new Set(input.delivery_days)].sort())}` : null,
        input.lead_days !== undefined ? `Lead time ${now.leadDays} to ${plural(input.lead_days, "day")}` : null,
        input.minimum !== undefined ? `Minimum order ${formatMoney(now.minimum)} to ${formatMoney(Math.round(input.minimum * 100))}` : null,
      ].filter((line): line is string => line !== null);
      if (details.length === 0) return { error: "Say which term to change." };
      return { title: "Change your terms", details: [...details, "Buyers see the new terms straight away."], confirmLabel: "Save terms", args: input };
    },
    exec: async (ctx, input) => {
      const now = await getBusinessProfile(ctx.session.orgId);
      const result = await callRpc("update_business_profile", {
        p_contact: now.contact,
        p_phone: now.phone,
        p_email: now.email,
        p_address: now.address,
        p_range: now.range,
        p_days: input.delivery_days ?? now.days,
        p_lead: input.lead_days ?? now.leadDays,
        p_cutoff: input.cutoff ?? now.cutoff,
        p_minimum: input.minimum ?? Number(now.minimum),
      });
      return result.ok ? { ok: true, data: "Terms saved. Buyers see them now." } : result;
    },
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
  writeTool({
    name: "accept_part",
    description:
      "Accept a new order but send less of some lines, for example when stock is short. lines lists only the products to change, with send_qty (0 drops the line). Use product_id from get_order.",
    input: z.object({
      order_number: orderNumberInput,
      delivery_date: z.iso.date(),
      lines: z.array(z.object({ product_id: z.uuid(), send_qty: z.number().int().min(0).max(9999) })).min(1).max(60),
    }),
    propose: async (_ctx, { order_number, delivery_date, lines }) => {
      const order = await findOrder(order_number);
      if (!order) return NOT_FOUND;
      if (order.status !== "pending") return { error: `${orderNumber(order.number)} is already ${order.status.replace(/_/g, " ")}.` };
      const changes = new Map(lines.map((line) => [line.product_id, line.send_qty]));
      const unknown = lines.find((line) => !order.lines.some((entry) => entry.productId === line.product_id));
      if (unknown) return { error: "One of those products is not on that order. Call get_order first." };
      if (order.lines.every((line) => (changes.get(line.productId) ?? line.qty) === 0)) return { error: "That sends nothing. Reject the order instead." };
      const over = order.lines.find((line) => (changes.get(line.productId) ?? 0) > line.qty);
      if (over) return { error: `You can send at most ${over.qty} of ${over.name}.` };
      return {
        title: `Accept part of ${orderNumber(order.number)} for ${formatDate(delivery_date)}`,
        details: [
          order.buyer.name,
          ...order.lines.map((line) => {
            const send = changes.get(line.productId) ?? line.qty;
            return send === line.qty ? `${line.qty} × ${line.name}` : send === 0 ? `Not sending ${line.name} (asked ${line.qty})` : `${send} of ${line.qty} × ${line.name}`;
          }),
        ],
        confirmLabel: "Accept these",
        args: { order_number, delivery_date, lines, order_id: order.id },
      };
    },
    exec: async (_ctx, args, key): Promise<ExecResult> => {
      const order = await findOrder(args.order_number);
      if (!order) return { ok: false, error: "That order is no longer there." };
      const changes = new Map(args.lines.map((line) => [line.product_id, line.send_qty]));
      const result = await callRpc("part_accept_order", {
        p_order: order.id,
        p_lines: order.lines.map((line) => ({ productId: line.productId, sendQty: changes.get(line.productId) ?? line.qty })),
        p_date: args.delivery_date,
        p_key: key,
      });
      if (!result.ok) return result;
      // Read again outside the per-request cache, so the card shows the new lines and total.
      const fresh = (await getOrders({ statuses: ["accepted"], limit: 60 })).find((entry) => entry.id === order.id);
      return {
        ok: true,
        data: `Accepted for ${formatDate(args.delivery_date)} with your changes. The buyer has been told.`,
        ...(fresh ? { card: orderCard(fresh, "supplier") } : {}),
      };
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
  cardTool({
    name: "add_product",
    description: "Adds the product from a new product card.",
    input: z.object({
      name: z.string().trim().min(2).max(80),
      unit: z.enum(UNITS),
      price: z.number().gt(0).max(99999),
      category: z.enum(CATEGORIES),
      opening: z.number().int().min(0).max(99999),
      reorder: z.number().int().min(0).max(9999),
    }),
    exec: async (ctx, input, key): Promise<ExecResult> => {
      const result = await callRpc<{ productId: string }>("supplier_add_product", {
        p_name: input.name,
        p_unit: input.unit,
        p_price: input.price,
        p_opening: input.opening,
        p_reorder: input.reorder,
        p_category: input.category,
        p_art: null,
        p_key: key,
      });
      if (!result.ok) return { ok: false, error: result.reason === "DUPLICATE" ? `${input.name} is already in your inventory.` : result.error };
      const item = await ownProduct(result.data.productId);
      return { ok: true, data: `${input.name} added. Buyers can now order it.`, ...(item ? { card: freshStock(stockCard(item, ctx.cardKey("S"))) } : {}) };
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
    name: "confirm_stock",
    description:
      "Confirm a product a buyer added (health unconfirmed): its real price, the stock you have and a reorder level. Buyers can then order it normally. Use product_id from get_inventory.",
    input: z.object({
      product_id: z.uuid(),
      qty: z.number().int().min(1).max(99999),
      price: z.number().gt(0).max(99999),
      reorder: z.number().int().min(0).max(9999).default(5),
    }),
    propose: async (_ctx, input) => {
      const item = await ownProduct(input.product_id);
      if (!item) return { error: "That product is not in your inventory." };
      if (item.health !== "unconfirmed") return { error: `${item.name} is already confirmed. Use receive_stock or change_price.` };
      return {
        title: `Confirm ${item.name}`,
        details: [`${plural(input.qty, item.unit)} in stock at ${formatMoney(Math.round(input.price * 100))} each`, `Reorder at ${input.reorder}`],
        confirmLabel: "Confirm stock",
        args: input,
      };
    },
    exec: async (ctx, input, key): Promise<ExecResult> => {
      const result = await callRpc("confirm_product_stock", {
        p_product: input.product_id,
        p_qty: input.qty,
        p_price: Math.round(input.price * 100) / 100,
        p_reorder: input.reorder,
        p_key: key,
      });
      if (!result.ok) return result;
      const item = await ownProduct(input.product_id);
      return { ok: true, data: "Confirmed. Buyers can order it now.", ...(item ? { card: stockCard(item, ctx.cardKey("S")) } : {}) };
    },
  }),
  writeTool({
    name: "adjust_stock",
    description:
      "Take stock off or put it back with a reason: damaged, expired or count_correction. change is negative to remove. Use product_id from get_inventory.",
    input: z.object({
      product_id: z.uuid(),
      change: z.number().int().min(-9999).max(9999).refine((value) => value !== 0),
      reason: z.enum(ADJUST_REASONS),
      note: z.string().max(500).default(""),
    }),
    propose: async (_ctx, input) => {
      const item = await ownProduct(input.product_id);
      if (!item) return { error: "That product is not in your inventory." };
      const after = item.onHand + input.change;
      if (after < item.reserved) return { error: `${item.reserved} of ${item.name} are reserved for orders, so on hand cannot go below that.` };
      return {
        title: `${input.change < 0 ? "Remove" : "Add"} ${plural(Math.abs(input.change), item.unit)} of ${item.name} (${REASON_WORDS[input.reason]})`,
        details: [`On hand ${item.onHand} to ${after}`, ...(input.note ? [`Note: ${input.note}`] : [])],
        confirmLabel: "Adjust stock",
        args: input,
      };
    },
    exec: async (ctx, input, key): Promise<ExecResult> => {
      const result = await callRpc("adjust_stock", {
        p_product: input.product_id,
        p_change: input.change,
        p_reason: input.reason,
        p_note: input.note,
        p_key: key,
      });
      if (!result.ok) return result.reason === "BELOW_RESERVED" ? { ok: false, error: "That would leave less than is reserved for orders." } : result;
      const item = await ownProduct(input.product_id);
      return { ok: true, data: "Stock adjusted.", ...(item ? { card: stockCard(item, ctx.cardKey("S")) } : {}) };
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
