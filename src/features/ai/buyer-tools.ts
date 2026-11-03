import "server-only";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { plural } from "@/domain/catalogue";
import { formatMoney, toCents } from "@/domain/money";
import { addToCartAction, placeCartAction } from "@/features/ask/actions";
import { productCartLine } from "@/features/ask/cart-lines";
import { getSupplierRecords, toOrderCard } from "@/features/ask/queries";
import {
  getBuyerCatalogue,
  getBuyerSettings,
  getConnectedSuppliers,
  getUsualItems,
  getWeekSpendCents,
} from "@/features/buyer/queries";
import { PROBLEM_TYPES } from "@/features/buyer/problem";
import { getReorderPlan } from "@/features/buyer/reorder-plan";
import { getTodos } from "@/features/buyer/todo-queries";
import { getDraft } from "@/features/ordering/queries";
import { getOrders, OPEN_STATUSES } from "@/features/orders/queries";
import { setCartQuantityAction } from "@/features/products/actions";
import { orderNumber } from "@/ui/format";
import { readTool, writeTool, type AiTool } from "./registry";
import { findOrder, NOT_FOUND, orderFacts, orderNumberInput } from "./shared";

const productId = z.uuid().describe("product_id from find_products, get_cart or get_order");
const qty = z.number().int().min(1).max(9999);

async function catalogueById() {
  return new Map((await getBuyerCatalogue()).map((item) => [item.id, item]));
}

const ORDER_FILTERS = {
  active: { statuses: OPEN_STATUSES },
  to_check: { toCheck: true },
  delivered: { statuses: ["delivered" as const] },
  problems: { checkStatuses: ["problem" as const] },
  cancelled: { statuses: ["cancelled" as const, "rejected" as const] },
  all: {},
};

export const BUYER_TOOLS: AiTool[] = [
  readTool({
    name: "find_products",
    description: "Search the buyer's connected suppliers' catalogue by name, brand or supplier. Returns price, unit, supplier and stock available.",
    input: z.object({ query: z.string().min(1).max(80).describe("Words to search, such as 'eggs' or 'cooking oil'") }),
    run: async (_ctx, { query }) => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const matches = (await getBuyerCatalogue())
        .map((item) => {
          const hay = [item.name, item.sku, item.supplierName, ...item.aliases].join(" ").toLowerCase();
          return { item, score: words.filter((word) => hay.includes(word)).length };
        })
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      return {
        data: matches.map(({ item }) => ({
          product_id: item.id,
          name: item.name,
          unit: item.unit,
          price: formatMoney(item.price),
          supplier: item.supplierName,
          available: item.status === "unconfirmed" ? "to be confirmed" : item.available,
        })),
      };
    },
  }),
  readTool({
    name: "list_orders",
    description: "The buyer's orders, newest first. Filter: active (not yet delivered), to_check (arrived or arriving, not yet checked), delivered, problems, cancelled or all.",
    input: z.object({ filter: z.enum(["active", "to_check", "delivered", "problems", "cancelled", "all"]), limit: z.number().int().min(1).max(20).default(8) }),
    run: async (ctx, { filter, limit }) => {
      const orders = await getOrders({ buyerOrgId: ctx.session.orgId, ...ORDER_FILTERS[filter], limit });
      return { data: orders.map(orderFacts), cards: orders.slice(0, 4).map((order) => ({ kind: "order", order: toOrderCard(order) })) };
    },
  }),
  readTool({
    name: "get_order",
    description: "One order by number, with every line and its product_id.",
    input: z.object({ order_number: orderNumberInput }),
    run: async (_ctx, { order_number }) => {
      const order = await findOrder(order_number);
      if (!order) return { data: NOT_FOUND };
      return { data: orderFacts(order), cards: [{ kind: "order", order: toOrderCard(order) }] };
    },
  }),
  readTool({
    name: "get_cart",
    description: "What is in the buyer's cart now, with prices and the cart version.",
    input: z.object({}),
    run: async (ctx) => {
      const [draft, byId] = await Promise.all([getDraft(ctx.session.userId), catalogueById()]);
      const lines = draft.lines.map((line) => {
        const item = line.productId ? byId.get(line.productId) : undefined;
        return item
          ? { product_id: item.id, item: item.name, qty: line.qty, unit: item.unit, supplier: item.supplierName, line_total: formatMoney(toCents(item.price) * line.qty) }
          : { item: line.sourceText, qty: line.qty, needs_choosing: true };
      });
      return { data: { version: draft.version, lines } };
    },
  }),
  readTool({
    name: "get_spending",
    description: "Spend this week (Monday to today, Singapore time) against the weekly budget, and the buyer's settings.",
    input: z.object({}),
    run: async (ctx) => {
      const [spent, settings] = await Promise.all([getWeekSpendCents(ctx.session.orgId), getBuyerSettings(ctx.session.orgId)]);
      const budget = toCents(settings.weeklyBudget);
      return { data: { spent_this_week: formatMoney(spent), weekly_budget: formatMoney(budget), left: formatMoney(Math.max(0, budget - spent)), settings } };
    },
  }),
  readTool({
    name: "get_alerts",
    description: "Things that need the buyer: price changes on usual items (with price_change_id), part deliveries, and supplier replies or promised credits on problems (with issue_id).",
    input: z.object({}),
    run: async (ctx) => {
      const todos = await getTodos(ctx.session.orgId);
      return {
        data: todos.map((todo) => ({
          title: todo.title,
          detail: todo.detail,
          kind: todo.action.kind,
          ...(todo.action.kind === "price" ? { price_change_id: todo.action.id } : {}),
          ...(todo.action.kind === "credit" || todo.action.kind === "reply" ? { issue_id: todo.action.id } : {}),
        })),
      };
    },
  }),
  readTool({
    name: "get_usual_items",
    description: "The buyer's usual items (usual quantity, use per day, count in the shop, last price paid) and what is running low and suggested for tomorrow.",
    input: z.object({}),
    run: async (ctx) => {
      const [usuals, plan, byId] = await Promise.all([getUsualItems(ctx.session.orgId), getReorderPlan(ctx.session.orgId), catalogueById()]);
      return {
        data: {
          usual: usuals.map((usual) => ({
            product_id: usual.productId,
            item: byId.get(usual.productId)?.name ?? "No longer listed",
            usual_qty: usual.usualQty,
            use_per_day: usual.usePerDay,
            in_shop: usual.inShop,
            last_paid: usual.lastPaid ? formatMoney(usual.lastPaid) : null,
          })),
          running_low: plan.rows.map((row) => ({ product_id: row.productId, item: row.item.name, days_left: row.daysLeft, suggested_qty: row.qty })),
        },
      };
    },
  }),
  readTool({
    name: "get_suppliers",
    description: "The buyer's suppliers: on-time record, cut-off times, delivery days and minimum order.",
    input: z.object({}),
    run: async (ctx) => {
      const [records, suppliers] = await Promise.all([getSupplierRecords(ctx.session.orgId), getConnectedSuppliers(ctx.session.orgId)]);
      return { data: { suppliers, on_time: records } };
    },
  }),

  writeTool({
    name: "add_to_cart",
    description: "Add products to the buyer's cart. Use product_id values from find_products. The buyer places orders from the cart.",
    input: z.object({ items: z.array(z.object({ product_id: productId, qty })).min(1).max(30) }),
    propose: async (_ctx, { items }) => {
      const byId = await catalogueById();
      const missing = items.find((entry) => !byId.has(entry.product_id));
      if (missing) return { error: "One of those products is not in the catalogue. Search again with find_products." };
      return {
        title: `Add ${items.length} ${items.length === 1 ? "item" : "items"} to your cart`,
        details: items.map((entry) => {
          const item = byId.get(entry.product_id);
          return `${entry.qty} × ${item?.name ?? ""} · ${item?.supplierName ?? ""} · ${formatMoney(toCents(item?.price ?? "0") * entry.qty)}`;
        }),
        confirmLabel: "Add to cart",
        args: { items },
      };
    },
    exec: async (_ctx, { items }) => {
      const result = await addToCartAction(items.map((entry) => productCartLine(entry.product_id, entry.qty, "Added by Tradelink AI", "manual")));
      return result.ok ? { ok: true, data: `Added ${result.data.added} to your cart.` } : result;
    },
  }),
  writeTool({
    name: "set_cart_quantity",
    description: "Change how many of a product are in the cart; 0 removes it.",
    input: z.object({ product_id: productId, qty: z.number().int().min(0).max(9999) }),
    propose: async (_ctx, input) => {
      const item = (await catalogueById()).get(input.product_id);
      if (!item) return { error: "That product is not in the catalogue." };
      return {
        title: input.qty === 0 ? `Remove ${item.name} from your cart` : `Set ${item.name} to ${input.qty} in your cart`,
        details: [`${item.supplierName} · ${formatMoney(item.price)} per ${item.unit}`],
        confirmLabel: input.qty === 0 ? "Remove" : "Update cart",
        args: input,
      };
    },
    exec: async (_ctx, input) => {
      const result = await setCartQuantityAction(input.product_id, input.qty);
      return result.ok ? { ok: true, data: "Cart updated." } : result;
    },
  }),
  writeTool({
    name: "place_order",
    description: "Place the whole cart as orders, one per supplier, and reserve stock. Call get_cart first so the buyer sees what will be ordered.",
    input: z.object({ cart_version: z.number().int().min(0).describe("version from get_cart") }),
    propose: async (ctx, { cart_version }) => {
      const [draft, byId] = await Promise.all([getDraft(ctx.session.userId), catalogueById()]);
      if (draft.lines.length === 0) return { error: "The cart is empty." };
      if (draft.version !== cart_version) return { error: "The cart changed. Call get_cart again." };
      const unresolved = draft.lines.filter((line) => !line.productId || !byId.has(line.productId));
      if (unresolved.length > 0) return { error: `${unresolved.length} cart lines still need a product chosen on the Cart page.` };
      const suppliers = new Set(draft.lines.map((line) => byId.get(line.productId ?? "")?.supplierName));
      const total = draft.lines.reduce((sum, line) => sum + toCents(byId.get(line.productId ?? "")?.price ?? "0") * line.qty, 0);
      return {
        title: `Place ${suppliers.size === 1 ? "1 order" : `${suppliers.size} orders`} · ${formatMoney(total)}`,
        details: draft.lines.map((line) => {
          const item = byId.get(line.productId ?? "");
          return `${line.qty} × ${item?.name ?? line.sourceText} · ${item?.supplierName ?? ""}`;
        }),
        confirmLabel: suppliers.size === 1 ? "Place order" : `Place ${suppliers.size} orders`,
        args: { cart_version },
      };
    },
    exec: async (_ctx, { cart_version }, key) => {
      const result = await placeCartAction(cart_version, key);
      if (!result.ok) return result;
      const placed = result.data.orders.map((order) => `${orderNumber(order.number)} to ${order.supplierName}`).join(", ");
      return { ok: true, data: `Placed and stock reserved: ${placed}.` };
    },
  }),
  ...orderWriteTools(),
  writeTool({
    name: "report_problem",
    description: "Report a problem with a delivered or arriving order line: short, damaged, wrong_item or expired.",
    input: z.object({
      order_number: orderNumberInput,
      product_id: productId,
      type: z.enum(PROBLEM_TYPES),
      qty: qty.describe("How many are affected"),
      note: z.string().max(500).default(""),
    }),
    propose: async (_ctx, input) => {
      const order = await findOrder(input.order_number);
      const line = order?.lines.find((entry) => entry.productId === input.product_id);
      if (!order || !line) return { error: "That item is not on that order. Call get_order first." };
      return {
        title: `Report ${input.type.replace("_", " ")} on ${orderNumber(order.number)}`,
        details: [`${input.qty} × ${line.name} from ${order.supplier.name}`, ...(input.note ? [`Note: ${input.note}`] : [])],
        confirmLabel: "Report problem",
        args: { ...input, order_id: order.id },
      };
    },
    exec: async (_ctx, input, key) => {
      const result = await callRpc("report_problem", {
        p_order: String((input as { order_id?: string }).order_id),
        p_product: input.product_id,
        p_type: input.type,
        p_qty: input.qty,
        p_note: input.note || null,
        p_key: key,
      });
      return result.ok ? { ok: true, data: "Problem reported. The supplier has been told." } : result;
    },
  }),
  writeTool({
    name: "acknowledge_price_change",
    description: "Mark a price change alert as noted. Use price_change_id from get_alerts.",
    input: z.object({ price_change_id: z.uuid() }),
    propose: async (ctx, { price_change_id }) => {
      const todo = (await getTodos(ctx.session.orgId)).find((entry) => entry.action.kind === "price" && entry.action.id === price_change_id);
      if (!todo) return { error: "That price change is not open." };
      return { title: "Mark this price change as noted", details: [todo.title, todo.detail], confirmLabel: "OK, noted", args: { price_change_id } };
    },
    exec: async (_ctx, { price_change_id }) => {
      const result = await callRpc("ack_price_change", { p_change: price_change_id });
      return result.ok ? { ok: true, data: "Price change noted." } : result;
    },
  }),
  writeTool({
    name: "mark_credit_received",
    description: "Mark a promised credit as received. Use issue_id from get_alerts.",
    input: z.object({ issue_id: z.uuid() }),
    propose: async (ctx, { issue_id }) => {
      const todo = (await getTodos(ctx.session.orgId)).find((entry) => entry.action.kind === "credit" && entry.action.id === issue_id);
      if (!todo) return { error: "No promised credit with that id." };
      return { title: "Mark the credit as received", details: [todo.title, todo.detail], confirmLabel: "Mark received", args: { issue_id } };
    },
    exec: async (_ctx, { issue_id }, key) => {
      const result = await callRpc("mark_credit_received", { p_issue: issue_id, p_key: key });
      return result.ok ? { ok: true, data: "Credit marked as received." } : result;
    },
  }),
  writeTool({
    name: "set_weekly_budget",
    description: "Change the weekly budget in Singapore dollars.",
    input: z.object({ amount: z.number().gt(0).max(9999999) }),
    propose: async (ctx, { amount }) => {
      const settings = await getBuyerSettings(ctx.session.orgId);
      return {
        title: `Set the weekly budget to ${formatMoney(Math.round(amount * 100))}`,
        details: [`It is ${formatMoney(settings.weeklyBudget)} now.`],
        confirmLabel: "Change budget",
        args: { amount },
      };
    },
    exec: async (ctx, { amount }) => {
      const settings = await getBuyerSettings(ctx.session.orgId);
      const result = await callRpc("update_buyer_settings", {
        p_budget: Math.round(amount * 100) / 100,
        p_suggest: settings.suggestReorder,
        p_price_alerts: settings.priceAlerts,
        p_budget_warning: settings.budgetWarning,
      });
      return result.ok ? { ok: true, data: "Weekly budget changed." } : result;
    },
  }),
  writeTool({
    name: "set_usual_item",
    description: "Add a product to the usual items or change its usual quantity, use per day and count in the shop.",
    input: z.object({
      product_id: productId,
      usual_qty: qty,
      use_per_day: z.number().min(0).max(9999).optional(),
      in_shop: z.number().min(0).max(999999).optional(),
    }),
    propose: async (ctx, input) => {
      const [item, usual] = await Promise.all([
        catalogueById().then((byId) => byId.get(input.product_id)),
        getUsualItems(ctx.session.orgId).then((list) => list.find((entry) => entry.productId === input.product_id)),
      ]);
      if (!item) return { error: "That product is not in the catalogue." };
      const usePerDay = input.use_per_day ?? usual?.usePerDay ?? 0;
      const inShop = input.in_shop ?? usual?.inShop ?? 0;
      return {
        title: `${usual ? "Update" : "Add"} ${item.name} in your usual items`,
        details: [`Usual ${plural(input.usual_qty, item.unit)}`, `Uses ${usePerDay} a day, ${inShop} in the shop`],
        confirmLabel: usual ? "Update usual" : "Add to usual",
        args: { ...input, use_per_day: usePerDay, in_shop: inShop },
      };
    },
    exec: async (_ctx, input) => {
      const result = await callRpc("set_usual_item", {
        p_product: input.product_id,
        p_usual_qty: input.usual_qty,
        p_use_per_day: input.use_per_day ?? 0,
        p_in_shop: input.in_shop ?? 0,
      });
      return result.ok ? { ok: true, data: "Usual items updated." } : result;
    },
  }),
  writeTool({
    name: "remove_usual_item",
    description: "Remove a product from the usual items.",
    input: z.object({ product_id: productId }),
    propose: async (_ctx, { product_id }) => {
      const item = (await catalogueById()).get(product_id);
      return { title: `Remove ${item?.name ?? "this item"} from your usual items`, details: [], confirmLabel: "Remove", args: { product_id } };
    },
    exec: async (_ctx, { product_id }) => {
      const result = await callRpc("remove_usual_item", { p_product: product_id });
      return result.ok ? { ok: true, data: "Removed from your usual items." } : result;
    },
  }),
];

/** Cancel, All here and Not here yet: the same shape, one database function each. */
function orderWriteTools(): AiTool[] {
  const specs = [
    { name: "cancel_order", rpc: "cancel_order", description: "Cancel a pending order the supplier has not accepted yet.", title: "Cancel", label: "Cancel order", done: "Order cancelled and stock released." },
    { name: "confirm_delivery", rpc: "confirm_all_here", description: "Confirm everything on a delivered or arriving order arrived.", title: "Confirm all here for", label: "All here", done: "Delivery confirmed." },
    { name: "report_not_here", rpc: "report_not_here", description: "Tell the supplier an order that is out for delivery has not arrived.", title: "Report not here yet for", label: "Not here yet", done: "The supplier has been told it has not arrived." },
  ];
  return specs.map((spec) =>
    writeTool({
      name: spec.name,
      description: spec.description,
      input: z.object({ order_number: orderNumberInput }),
      propose: async (_ctx, { order_number }) => {
        const order = await findOrder(order_number);
        if (!order) return NOT_FOUND;
        return {
          title: `${spec.title} ${orderNumber(order.number)}`,
          details: [`${order.supplier.name} · ${order.status.replace(/_/g, " ")} · ${formatMoney(order.totalCents)}`, ...order.lines.map((line) => `${line.qty} × ${line.name}`)],
          confirmLabel: spec.label,
          args: { order_number, order_id: order.id },
        };
      },
      exec: async (_ctx, args, key) => {
        const result = await callRpc(spec.rpc, { p_order: String((args as { order_id?: string }).order_id), p_key: key });
        return result.ok ? { ok: true, data: spec.done } : result;
      },
    }),
  );
}
