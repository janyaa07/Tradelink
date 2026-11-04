import "server-only";
import { z } from "zod";
import { getCatalogue } from "@/data/catalogue";
import { callRpc } from "@/data/rpc";
import { plural, UNITS, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, toCents } from "@/domain/money";
import { addToCartAction, placeCartAction } from "@/features/ask/actions";
import { productCartLine } from "@/features/ask/cart-lines";
import { getSupplierRecords } from "@/features/ask/queries";
import {
  getBuyerCatalogue,
  getBuyerSettings,
  getConnectedSuppliers,
  getDeliveryTerms,
  getUsualItems,
  getWeekSpendCents,
} from "@/features/buyer/queries";
import { PROBLEM_TYPES } from "@/features/buyer/problem";
import { getReorderPlan } from "@/features/buyer/reorder-plan";
import { getTodos } from "@/features/buyer/todo-queries";
import type { PlacedOrders } from "@/features/ordering/actions";
import { getDraft, readDraft } from "@/features/ordering/queries";
import { quantitiesByProduct } from "@/features/ordering/line-ops";
import { getOrders, OPEN_STATUSES } from "@/features/orders/queries";
import { setCartQuantityAction } from "@/features/products/actions";
import { orderNumber } from "@/ui/format";
import type { AiCard } from "@/domain/ask/types";
import { formatDaysLeft } from "@/domain/reorder";
import { weekdayName } from "@/domain/singapore-time";
import { orderCard, productCard, tag } from "./cards";
import { cardTool, readTool, writeTool, type AiContext, type AiTool, type ExecResult } from "./registry";
import { orderContext } from "./order-context";
import { orderRequestTools } from "./order-request-tools";
import { deliveryDay, findOrder, NOT_FOUND, orderFacts, orderNumberInput } from "./shared";

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

async function cartQuantities(userId: string): Promise<Map<string, number>> {
  return quantitiesByProduct((await getDraft(userId)).lines);
}

/** The cart as a card: every line with its supplier, price and the stock free to order now. */
async function cartCard(userId: string, fresh = false): Promise<Extract<AiCard, { kind: "ai_cart" }>> {
  const [draft, byId] = await Promise.all([fresh ? readDraft(userId) : getDraft(userId), catalogueById()]);
  const lines = draft.lines.map((line) => {
    const item = line.productId ? byId.get(line.productId) : undefined;
    return item
      ? {
          productId: item.id,
          name: item.name,
          qty: line.qty,
          unit: item.unit,
          supplier: item.supplierName,
          lineCents: toCents(item.price) * line.qty,
          available: item.status === "unconfirmed" ? null : item.available,
        }
      : { productId: null, name: line.sourceText, qty: line.qty, unit: "", supplier: null, lineCents: null, available: null };
  });
  return {
    kind: "ai_cart",
    key: "CART",
    cart: {
      version: draft.version,
      lines,
      totalCents: lines.reduce((sum, line) => sum + (line.lineCents ?? 0), 0),
      suppliers: new Set(lines.map((line) => line.supplier).filter(Boolean)).size,
      unresolved: lines.filter((line) => !line.productId).length,
    },
  };
}

const itemsInput = z.object({
  items: z
    .array(z.object({ product_id: productId, qty }))
    .min(1)
    .max(30),
});

/** Checks requested items against what the buyer can see and what is free to order. */
function checkItems(items: z.infer<typeof itemsInput>["items"], byId: Map<string, CatalogueItem>): string | null {
  for (const entry of items) {
    const item = byId.get(entry.product_id);
    if (!item) return "One of those products is not in the catalogue. Search again with find_products.";
    if (item.status === "active" && entry.qty > item.available) {
      return item.available > 0 ? `Only ${plural(item.available, item.unit)} of ${item.name} available.` : `${item.name} is out of stock.`;
    }
  }
  return null;
}

function supplierError(result: { error: string; reason?: string; detail?: string }): string {
  if (result.reason !== "DUPLICATE") return result.error;
  return result.detail === "connected"
    ? "That supplier is already one of yours. Choose it from the list."
    : "A supplier with that name is already on Tradelink. Ask Tradelink support to connect you.";
}

/** The supplier for a new product: one the buyer has, or a new one added first. */
async function supplierForProduct(ctx: AiContext, supplierId: string | undefined, newSupplier: string | undefined, key: string) {
  if (supplierId) return { ok: true as const, id: supplierId, created: false };
  const added = await callRpc<{ supplierId: string }>("buyer_add_supplier", { p_name: newSupplier, p_contact: null, p_phone: null, p_key: key });
  if (added.ok) return { ok: true as const, id: added.data.supplierId, created: true };
  if (added.reason === "DUPLICATE" && added.detail === "connected") {
    // Added on an earlier tap whose product then failed: use it.
    const existing = (await getConnectedSuppliers(ctx.session.orgId)).find((entry) => entry.name.toLowerCase() === newSupplier?.toLowerCase());
    if (existing) return { ok: true as const, id: existing.id, created: false };
  }
  return { ok: false as const, error: supplierError(added) };
}

/** A product card for something just added, so the card says so. */
function freshCard(card: AiCard): AiCard {
  return card.kind === "ai_product" ? { ...card, product: { ...card.product, added: true } } : card;
}

export const BUYER_TOOLS: AiTool[] = [
  readTool({
    name: "find_products",
    description:
      "Search the catalogue of the buyer's suppliers by name, brand or supplier. Returns price, unit, supplier, stock available and a card tag for each.",
    input: z.object({ query: z.string().min(1).max(80).describe("Words to search, such as 'eggs' or 'cooking oil'") }),
    run: async (ctx, { query }) => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const [catalogue, inCart] = await Promise.all([getBuyerCatalogue(), cartQuantities(ctx.session.userId)]);
      const matches = catalogue
        .map((item) => {
          const hay = [item.name, item.sku, item.supplierName, ...item.aliases].join(" ").toLowerCase();
          return { item, score: words.filter((word) => hay.includes(word)).length };
        })
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      const cards = matches.map(({ item }) => productCard(item, inCart.get(item.id) ?? 0, ctx.cardKey("P")));
      return {
        data: matches.map(({ item }, index) => ({
          card: cards[index] ? tag(cards[index]) : null,
          product_id: item.id,
          name: item.name,
          unit: item.unit,
          price: formatMoney(item.price),
          supplier: item.supplierName,
          available: item.status === "unconfirmed" ? "to be confirmed" : item.available,
          in_cart: inCart.get(item.id) ?? 0,
        })),
        cards,
      };
    },
  }),
  readTool({
    name: "list_orders",
    description:
      "The buyer's orders, newest first. filter: active (not yet delivered), to_check (arrived or arriving, not yet checked), delivered, problems, cancelled or all. delivery_on narrows to one delivery day: 'today', 'tomorrow' or YYYY-MM-DD. Use it whenever the person names a day.",
    input: z.object({
      filter: z.enum(["active", "to_check", "delivered", "problems", "cancelled", "all"]),
      delivery_on: z
        .string()
        .regex(/^(today|tomorrow|\d{4}-\d{2}-\d{2})$/)
        .optional(),
      limit: z.number().int().min(1).max(20).default(8),
    }),
    run: async (ctx, { filter, delivery_on, limit }) => {
      const day = deliveryDay(delivery_on, ctx.now);
      const orders = (await getOrders({ buyerOrgId: ctx.session.orgId, ...ORDER_FILTERS[filter], limit: day ? 60 : limit }))
        .filter((order) => !day || (order.confirmedDeliveryDate ?? order.requestedDeliveryDate) === day)
        .slice(0, limit);
      const cards = orders.map((order) => orderCard(order, "buyer"));
      return { data: orders.map((order, index) => ({ card: cards[index] ? tag(cards[index]) : null, ...orderFacts(order) })), cards };
    },
  }),
  readTool({
    name: "get_order",
    description:
      "One order by number: every line with its product_id, and why it is flagged (problems reported and where each stands, what the supplier could not send, below minimum), the second delivery, and recent messages and date changes. Use it to explain any order.",
    input: z.object({ order_number: orderNumberInput }),
    run: async (ctx, { order_number }) => {
      const order = await findOrder(order_number);
      if (!order) return { data: NOT_FOUND };
      const card = orderCard(order, "buyer");
      return { data: { card: tag(card), ...orderFacts(order), ...(await orderContext(order, ctx.session.orgId)) }, cards: [card] };
    },
  }),
  readTool({
    name: "get_cart",
    description:
      "What is in the buyer's cart now, with prices, stock free to order, the cart version and a cart card tag. The card lets them change quantities and place the cart.",
    input: z.object({}),
    run: async (ctx) => {
      const card = await cartCard(ctx.session.userId);
      return {
        data: {
          card: tag(card),
          version: card.cart.version,
          lines: card.cart.lines.map((line) => ({
            product_id: line.productId,
            item: line.name,
            qty: line.qty,
            unit: line.unit,
            supplier: line.supplier,
            line_total: line.lineCents === null ? null : formatMoney(line.lineCents),
            available: line.available,
          })),
        },
        cards: [card],
      };
    },
  }),
  readTool({
    name: "get_spending",
    description: "Spend this week (Monday to today, Singapore time) against the weekly budget, the buyer's settings and a spend card tag.",
    input: z.object({}),
    run: async (ctx) => {
      const [spent, settings] = await Promise.all([getWeekSpendCents(ctx.session.orgId), getBuyerSettings(ctx.session.orgId)]);
      const budget = toCents(settings.weeklyBudget);
      const card: AiCard = { kind: "ai_spend", key: "SPEND", spend: { spentCents: spent, budgetCents: budget } };
      return {
        data: {
          card: tag(card),
          spent_this_week: formatMoney(spent),
          weekly_budget: formatMoney(budget),
          left: formatMoney(Math.max(0, budget - spent)),
          settings,
        },
        cards: [card],
      };
    },
  }),
  readTool({
    name: "get_alerts",
    description:
      "Things that need the buyer: price changes on usual items, part deliveries, supplier replies or promised credits on problems, and delivery date changes a supplier asked for (answer with answer_date_change and the request_id). Each has a card tag with its own buttons.",
    input: z.object({}),
    run: async (ctx) => {
      const todos = await getTodos(ctx.session.orgId);
      const cards: AiCard[] = todos.map((todo) => ({
        kind: "ai_alert",
        key: ctx.cardKey("A"),
        alert: { id: todo.action.id, kind: todo.action.kind, title: todo.title, detail: todo.detail, tone: todo.tone },
      }));
      return {
        data: todos.map((todo, index) => ({
          card: cards[index] ? tag(cards[index]) : null,
          title: todo.title,
          detail: todo.detail,
          kind: todo.action.kind,
          ...(todo.action.kind === "price" ? { price_change_id: todo.action.id } : {}),
          ...(todo.action.kind === "credit" || todo.action.kind === "reply" ? { issue_id: todo.action.id } : {}),
          ...(todo.action.kind === "date" ? { request_id: todo.action.id } : {}),
        })),
        cards,
      };
    },
  }),
  readTool({
    name: "get_usual_items",
    description:
      "The buyer's usual items (usual quantity, use per day, count in the shop, last price paid) and what is running low with a suggested quantity. Running-low items have product card tags with the suggestion filled in.",
    input: z.object({}),
    run: async (ctx) => {
      const [usuals, plan, byId, inCart] = await Promise.all([
        getUsualItems(ctx.session.orgId),
        getReorderPlan(ctx.session.orgId),
        catalogueById(),
        cartQuantities(ctx.session.userId),
      ]);
      const cards = plan.rows.map((row) => {
        const card = productCard(row.item, inCart.get(row.productId) ?? 0, ctx.cardKey("P"));
        return card.kind === "ai_product"
          ? { ...card, product: { ...card.product, suggestedQty: row.qty, note: `${formatDaysLeft(row.daysLeft)} days left` } }
          : card;
      });
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
          running_low: plan.rows.map((row, index) => ({
            card: cards[index] ? tag(cards[index]) : null,
            product_id: row.productId,
            item: row.item.name,
            days_left: row.daysLeft,
            suggested_qty: row.qty,
          })),
        },
        cards,
      };
    },
  }),
  readTool({
    name: "get_suppliers",
    description: "The buyer's suppliers: on-time record, cut-off time and delivery days, each with a card tag.",
    input: z.object({}),
    run: async (ctx) => {
      const [records, suppliers] = await Promise.all([getSupplierRecords(ctx.session.orgId), getConnectedSuppliers(ctx.session.orgId)]);
      const terms = await getDeliveryTerms(suppliers.map((supplier) => supplier.id));
      const cards: AiCard[] = suppliers.map((supplier) => {
        const record = records.find((entry) => entry.supplierId === supplier.id);
        const term = terms.get(supplier.id);
        return {
          kind: "ai_supplier",
          key: ctx.cardKey("SUP"),
          supplier: {
            name: supplier.name,
            onTimePercent: record && record.delivered > 0 ? record.percent : null,
            deliveries: record?.delivered ?? 0,
            cutOff: term ? term.cutoffTime.slice(0, 5) : null,
            deliveryDays: term ? term.deliveryDays.map((day) => weekdayName(day).slice(0, 3)).join(", ") : null,
          },
        };
      });
      return {
        data: suppliers.map((supplier, index) => ({
          card: cards[index] ? tag(cards[index]) : null,
          supplier: supplier.name,
          status: supplier.status,
          on_time: records.find((entry) => entry.supplierId === supplier.id) ?? null,
          terms: terms.get(supplier.id) ?? null,
        })),
        cards,
      };
    },
  }),

  writeTool({
    name: "add_to_cart",
    description:
      "Add products to the buyer's cart to order later. Use product_id values from find_products. When they say to order or buy now, use order_now instead.",
    input: itemsInput,
    propose: async (_ctx, { items }) => {
      const byId = await catalogueById();
      if (!items.every((entry) => byId.has(entry.product_id)))
        return { error: "One of those products is not in the catalogue. Search again with find_products." };
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
      if (!result.ok) return result;
      const first = items[0];
      const item = first && items.length === 1 ? (await catalogueById()).get(first.product_id) : undefined;
      return {
        ok: true,
        data: item && first ? `Added ${plural(first.qty, item.unit)} of ${item.name} to your cart.` : `Added ${items.length} items to your cart.`,
      };
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
    exec: async (ctx, input): Promise<ExecResult> => {
      const result = await setCartQuantityAction(input.product_id, input.qty);
      if (!result.ok) return result;
      return { ok: true, data: input.qty === 0 ? "Removed from your cart." : "Cart updated.", card: await cartCard(ctx.session.userId, true) };
    },
  }),
  writeTool({
    name: "order_now",
    description:
      "Place an order straight away for just these products, one order per supplier, without using or changing the cart. Use when the person says to order or buy something now. Use product_id values from find_products.",
    input: itemsInput,
    propose: async (_ctx, { items }) => {
      const byId = await catalogueById();
      const problem = checkItems(items, byId);
      if (problem) return { error: problem };
      const suppliers = new Set(items.map((entry) => byId.get(entry.product_id)?.supplierName));
      const total = items.reduce((sum, entry) => sum + toCents(byId.get(entry.product_id)?.price ?? "0") * entry.qty, 0);
      const first = items[0];
      const firstItem = first ? byId.get(first.product_id) : undefined;
      return {
        title:
          items.length === 1 && first && firstItem
            ? `Order ${plural(first.qty, firstItem.unit)} of ${firstItem.name} now · ${formatMoney(total)}`
            : `Order ${items.length} items now · ${formatMoney(total)}`,
        details: [
          ...items.map((entry) => {
            const item = byId.get(entry.product_id);
            return `${entry.qty} × ${item?.name ?? ""} · ${item?.supplierName ?? ""} · ${formatMoney(toCents(item?.price ?? "0") * entry.qty)}`;
          }),
          "Your cart stays as it is.",
        ],
        confirmLabel: suppliers.size === 1 ? "Place order" : `Place ${suppliers.size} orders`,
        args: { items },
      };
    },
    exec: async (_ctx, { items }, key): Promise<ExecResult> => {
      const byId = await catalogueById();
      const problem = checkItems(items, byId);
      if (problem) return { ok: false, error: problem };
      const result = await callRpc<PlacedOrders>("place_orders", {
        p_lines: items.map((entry) => ({ productId: entry.product_id, qty: entry.qty, sourceText: "Ordered with Tradelink AI" })),
        p_draft_version: null,
        p_key: key,
      });
      if (!result.ok)
        return result.reason === "STOCK_SHORT" ? { ok: false, error: "Some of that just sold out. Ask again to see what is left." } : result;
      const placed = result.data.orders.map((order) => `${orderNumber(order.number)} to ${order.supplierName}`).join(", ");
      return { ok: true, data: `Placed ${placed}. Your cart is unchanged.` };
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
  readTool({
    name: "new_product_form",
    description:
      "Show a form card to add a product that is not in the catalogue, filled in from the request. Pass the supplier name they gave, even if it is new: the form then adds that supplier too. The person checks the details and taps Add product.",
    input: z.object({
      name: z.string().trim().min(2).max(80),
      unit: z.enum(UNITS).optional().describe("Best guess from the product, such as bag for rice or dal, bottle for oil"),
      price: z.number().gt(0).max(99999).optional().describe("Only a price the person gave"),
      supplier: z.string().trim().min(2).max(120).optional().describe("Supplier name the person gave"),
    }),
    run: async (ctx, input) => {
      const [suppliers, catalogue] = await Promise.all([getConnectedSuppliers(ctx.session.orgId), getBuyerCatalogue()]);
      const wanted = input.supplier?.toLowerCase();
      const match = wanted ? suppliers.find((entry) => entry.name.toLowerCase() === wanted || entry.name.toLowerCase().includes(wanted)) : undefined;
      const similar = catalogue.filter((item) => item.name.toLowerCase().includes(input.name.toLowerCase())).slice(0, 3);
      const card: AiCard = {
        kind: "ai_new_product",
        key: ctx.cardKey("NEW"),
        view: "buyer",
        form: {
          name: input.name,
          unit: input.unit ?? null,
          priceCents: input.price ? toCents(input.price) : null,
          suppliers: suppliers.map((entry) => ({ id: entry.id, name: entry.name })),
          supplierId: match?.id ?? (!input.supplier && suppliers.length === 1 ? (suppliers[0]?.id ?? null) : null),
          newSupplier: input.supplier && !match ? input.supplier : null,
          category: null,
          opening: null,
          reorder: null,
        },
      };
      return {
        data: {
          card: tag(card),
          new_supplier: input.supplier && !match ? input.supplier : null,
          similar_in_catalogue: similar.map((item) => `${item.name} from ${item.supplierName}`),
          note: "Nothing is added until they tap Add product on the card.",
        },
        cards: [card],
      };
    },
  }),
  readTool({
    name: "new_supplier_form",
    description:
      "Show a form card to add a supplier who is not on Tradelink yet, filled in from the request. The person checks it and taps Add supplier.",
    input: z.object({
      name: z.string().trim().min(2).max(120),
      contact: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(20).optional(),
    }),
    run: async (ctx, input) => {
      const card: AiCard = {
        kind: "ai_new_supplier",
        key: ctx.cardKey("NS"),
        form: { name: input.name, contact: input.contact ?? null, phone: input.phone ?? null },
      };
      return { data: { card: tag(card), note: "Nothing is added until they tap Add supplier on the card." }, cards: [card] };
    },
  }),
  cardTool({
    name: "add_product",
    description: "Adds the product from a new product card.",
    input: z
      .object({
        name: z.string().trim().min(2).max(80),
        unit: z.enum(UNITS),
        price: z.number().gt(0).max(99999),
        supplier_id: z.uuid().optional(),
        new_supplier: z.string().trim().min(2).max(120).optional(),
      })
      .refine((value) => Boolean(value.supplier_id) !== Boolean(value.new_supplier)),
    exec: async (ctx, input, key): Promise<ExecResult> => {
      const supplier = await supplierForProduct(ctx, input.supplier_id, input.new_supplier, key);
      if (!supplier.ok) return { ok: false, error: supplier.error };
      const result = await callRpc<{ productId: string }>("buyer_add_product", {
        p_name: input.name,
        p_unit: input.unit,
        p_price: input.price,
        p_supplier: supplier.id,
        p_key: key,
      });
      if (!result.ok) {
        return {
          ok: false,
          error: result.reason === "DUPLICATE" ? `${input.name} is already in that supplier's catalogue. Search for it instead.` : result.error,
        };
      }
      const item = (await getCatalogue()).find((entry) => entry.id === result.data.productId);
      const who = item?.supplierName ?? input.new_supplier ?? "The supplier";
      return {
        ok: true,
        data: `Added ${input.name}${supplier.created ? ` and ${who} as a new supplier` : ""}. ${who} confirms the price and stock.`,
        ...(item ? { card: freshCard(productCard(item, 0, "P0")) } : {}),
      };
    },
  }),
  cardTool({
    name: "add_supplier",
    description: "Adds the supplier from a new supplier card.",
    input: z.object({
      name: z.string().trim().min(2).max(120),
      contact: z.string().trim().max(120).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ]{8,16}$/)
        .optional(),
    }),
    exec: async (_ctx, input, key): Promise<ExecResult> => {
      const result = await callRpc<{ supplierId: string; name: string }>("buyer_add_supplier", {
        p_name: input.name,
        p_contact: input.contact ?? null,
        p_phone: input.phone ?? null,
        p_key: key,
      });
      if (!result.ok) return { ok: false, error: supplierError(result) };
      return {
        ok: true,
        data: `Added ${result.data.name}. Tradelink invites them, and you can add their products now.`,
        card: {
          kind: "ai_supplier",
          key: "SUP0",
          supplier: { name: result.data.name, invited: true, onTimePercent: null, deliveries: 0, cutOff: null, deliveryDays: null },
        },
      };
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
  ...orderRequestTools("buyer"),
];

/** Cancel, All here and Not here yet: the same shape, one database function each. */
function orderWriteTools(): AiTool[] {
  const specs = [
    {
      name: "cancel_order",
      rpc: "cancel_order",
      description: "Cancel a pending order the supplier has not accepted yet.",
      title: "Cancel",
      label: "Cancel order",
      done: "Order cancelled and stock released.",
    },
    {
      name: "confirm_delivery",
      rpc: "confirm_all_here",
      description: "Confirm everything on a delivered or arriving order arrived.",
      title: "Confirm all here for",
      label: "All here",
      done: "Delivery confirmed.",
    },
    {
      name: "report_not_here",
      rpc: "report_not_here",
      description: "Tell the supplier an order that is out for delivery has not arrived.",
      title: "Report not here yet for",
      label: "Not here yet",
      done: "The supplier has been told it has not arrived.",
    },
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
          details: [
            `${order.supplier.name} · ${order.status.replace(/_/g, " ")} · ${formatMoney(order.totalCents)}`,
            ...order.lines.map((line) => `${line.qty} × ${line.name}`),
          ],
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
