import "server-only";
import type { Session } from "@/data/session";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { routeIntent, readsAsOrder } from "@/domain/ask/intents";
import { findPriceProduct, productsNamedIn } from "@/domain/ask/products";
import {
  ASK_COPY,
  availabilityLabel,
  deliveriesText,
  orderFoundText,
  otherShopsText,
  priceText,
  reliabilityText,
  restockText,
  spendText,
  textReply,
  unitPriceLabel,
} from "@/domain/ask/replies";
import { bestRecord } from "@/domain/ask/supplier-record";
import type { AskReply, AskTurn } from "@/domain/ask/types";
import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney, toCents } from "@/domain/money";
import { readOrderWithRules } from "@/domain/reader/rules";
import { formatDaysLeft } from "@/domain/restock";
import {
  getBuyerCatalogue,
  getBuyerSettings,
  getUsualItems,
  getWeekSpendCents,
} from "@/features/buyer/queries";
import { getRestockPlan } from "@/features/buyer/restock-plan";
import { readOrderAction } from "@/features/ordering/actions";
import type { DraftLine } from "@/features/ordering/draft";
import { getOrders, OPEN_STATUSES } from "@/features/orders/queries";
import { claudeModel, isClaudeConfigured } from "@/integrations/claude/client";
import { orderNumber } from "@/ui/format";
import { answerOpenQuestion, type AnswerUsage } from "./answer";
import { hasUsableLine, lineRow, productCartLine, readRows, toCartLine } from "./cart-lines";
import { buildFacts } from "./facts";
import { getOrderCardByNumber, getSupplierRecords, toOrderCard } from "./queries";

const INSIGHTS = "/buyer/insights";
const MAX_DELIVERIES = 20;
const MAX_NAMED_PRODUCTS = 5;

async function orderNumberReply(orgId: string, number: number): Promise<AskReply> {
  const order = await getOrderCardByNumber(orgId, number);
  if (!order) return textReply(ASK_COPY.orderNotFound);
  return { text: orderFoundText(orderNumber(order.number)), cards: [{ kind: "order", order }], actions: [] };
}

async function spendReply(orgId: string): Promise<AskReply> {
  const [spentCents, settings] = await Promise.all([getWeekSpendCents(orgId), getBuyerSettings(orgId)]);
  return {
    text: spendText(spentCents, toCents(settings.weeklyBudget)),
    cards: [],
    actions: [{ kind: "link", label: "Open Insights", href: INSIGHTS }],
  };
}

async function deliveriesReply(orgId: string): Promise<AskReply> {
  const orders = await getOrders({ buyerOrgId: orgId, statuses: ["out_for_delivery"], limit: MAX_DELIVERIES });
  if (orders.length === 0) return textReply(ASK_COPY.nothingOnTheWay);
  return {
    text: deliveriesText(orders.length),
    cards: orders.map((order) => ({ kind: "order", order: toOrderCard(order) })),
    actions: [],
  };
}

type UsualCopy = { text: string; empty: string };

/** "Order my usual": every usual item still in the catalogue at its usual quantity, with Add to cart. */
async function usualReply(orgId: string, copy: UsualCopy): Promise<AskReply> {
  const [usuals, catalogue] = await Promise.all([getUsualItems(orgId), getBuyerCatalogue()]);
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const lines = usuals
    .filter((usual) => byId.has(usual.productId))
    .map((usual) => productCartLine(usual.productId, usual.usualQty, "My usual", "suggested"));
  if (lines.length === 0) return textReply(copy.empty);
  return {
    text: copy.text,
    cards: [{ kind: "lines", rows: lines.map((line) => lineRow(line, byId, null)) }],
    actions: [{ kind: "add_to_cart", lines }],
  };
}

/** "What should I reorder?": the restock plan with Add to cart, else the usual items. */
async function restockReply(orgId: string): Promise<AskReply> {
  const plan = await getRestockPlan(orgId);
  if (plan.rows.length === 0) return usualReply(orgId, { text: ASK_COPY.enoughStockUsual, empty: ASK_COPY.enoughStock });
  const byId = new Map(plan.rows.map((row) => [row.productId, row.item]));
  const suggested = plan.rows.map((row) => {
    const daysLeft = `${formatDaysLeft(row.daysLeft)} days left`;
    return { daysLeft, line: productCartLine(row.productId, row.qty, `Suggested, ${daysLeft}`, "suggested") };
  });
  return {
    text: restockText(plan.rows.length),
    cards: [{ kind: "lines", rows: suggested.map(({ line, daysLeft }) => lineRow(line, byId, daysLeft)) }],
    actions: [{ kind: "add_to_cart", lines: suggested.map(({ line }) => line) }],
  };
}

async function reliabilityReply(orgId: string): Promise<AskReply> {
  const best = bestRecord(await getSupplierRecords(orgId));
  return {
    text: best ? reliabilityText(best.name, best.percent) : ASK_COPY.noSupplierRecord,
    cards: [],
    actions: [{ kind: "link", label: "See all suppliers", href: INSIGHTS }],
  };
}

async function priceReply(orgId: string, query: string): Promise<AskReply> {
  const [catalogue, usuals] = await Promise.all([getBuyerCatalogue(), getUsualItems(orgId)]);
  const item = findPriceProduct(query, catalogue);
  if (!item) return textReply(ASK_COPY.productNotFound);
  const lastPaid = usuals.find((usual) => usual.productId === item.id)?.lastPaid ?? null;
  const soldOut = item.status === "active" && item.available <= 0;
  return {
    text: priceText(item),
    cards: [
      {
        kind: "price",
        price: {
          name: item.name,
          art: item.art,
          category: item.category,
          price: unitPriceLabel(item),
          supplierName: item.supplierName,
          available: availabilityLabel(item),
          lastPaid: lastPaid ? formatMoney(lastPaid) : null,
        },
      },
    ],
    actions: soldOut ? [] : [{ kind: "add_to_cart", lines: [productCartLine(item.id, 1, "Added by you", "manual")] }],
  };
}

/** "Here is what I read" with each line's state and price, when at least one line matched or has options (BUY-49). */
function readOrderReply(lines: DraftLine[], catalogue: CatalogueItem[]): AskReply | null {
  if (!hasUsableLine(lines)) return null;
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  return {
    text: ASK_COPY.readOrder,
    cards: [{ kind: "lines", rows: readRows(lines, byId) }],
    actions: [{ kind: "add_to_cart", lines: lines.map(toCartLine) }],
  };
}

async function recordUsage(usage: AnswerUsage, factsGiven: number, factsCited: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("record_ai_usage", {
    p_feature: "ask",
    p_model: claudeModel(),
    p_input: usage.inputTokens,
    p_output: usage.outputTokens,
    p_latency: usage.latencyMs,
    p_outcome: usage.outcome,
    p_lines_read: factsGiven,
    p_lines_matched: factsCited,
  });
}

async function openQuestionReply(
  session: Session,
  message: string,
  history: AskTurn[],
  catalogue: CatalogueItem[],
): Promise<AskReply> {
  const [spentCents, settings, openOrders, plan, usuals, suppliers] = await Promise.all([
    getWeekSpendCents(session.orgId),
    getBuyerSettings(session.orgId),
    getOrders({ buyerOrgId: session.orgId, statuses: OPEN_STATUSES, limit: 10 }),
    getRestockPlan(session.orgId),
    getUsualItems(session.orgId),
    getSupplierRecords(session.orgId),
  ]);
  const lastPaid = new Map(usuals.map((usual) => [usual.productId, usual.lastPaid]));
  const facts = buildFacts({
    businessName: session.orgName,
    spentCents,
    budgetCents: toCents(settings.weeklyBudget),
    openOrders: openOrders.map(toOrderCard),
    plan: plan.rows.map((row) => ({ name: row.item.name, daysLeft: row.daysLeft, qty: row.qty, unit: row.item.unit })),
    products: productsNamedIn(message, catalogue, MAX_NAMED_PRODUCTS).map((item) => ({
      item,
      lastPaid: lastPaid.get(item.id) ?? null,
    })),
    suppliers,
  });

  const { answer, usage } = await answerOpenQuestion(message, history, facts);
  await recordUsage(usage, facts.length, answer.kind === "grounded" ? answer.factIds.length : 0);
  if (answer.kind === "grounded") return textReply(answer.text);
  return textReply(answer.kind === "unavailable" ? ASK_COPY.unavailable : ASK_COPY.fallback);
}

/** No intent matched: a typed order goes to the order reader, anything else to the facts-only model. */
async function unmatchedReply(session: Session, message: string, history: AskTurn[]): Promise<AskReply> {
  const catalogue = await getBuyerCatalogue();
  const rulesFoundProduct = readOrderWithRules(message, catalogue).lines.some(
    (line) => line.productId !== null || line.options.length > 0,
  );
  if (readsAsOrder(message, rulesFoundProduct)) {
    const read = await readOrderAction(message);
    const reply = read.ok ? readOrderReply(read.data.lines, catalogue) : null;
    if (reply) return reply;
  }
  if (!isClaudeConfigured()) return textReply(ASK_COPY.fallback);
  return openQuestionReply(session, message, history, catalogue);
}

/** Answers one Tradelink Assistant message for the signed-in buyer; every query runs as the user, so RLS applies. */
export async function respondToAsk(session: Session, message: string, history: AskTurn[]): Promise<AskReply> {
  const intent = routeIntent(message);
  switch (intent.kind) {
    case "other_shops":
      return textReply(otherShopsText(session.orgName));
    case "order_number":
      return orderNumberReply(session.orgId, intent.number);
    case "spend":
      return spendReply(session.orgId);
    case "deliveries":
      return deliveriesReply(session.orgId);
    case "restock":
      return restockReply(session.orgId);
    case "usual":
      return usualReply(session.orgId, { text: ASK_COPY.usual, empty: ASK_COPY.noUsuals });
    case "reliability":
      return reliabilityReply(session.orgId);
    case "price":
      return priceReply(session.orgId, intent.query);
    case "none":
      return unmatchedReply(session, message, history);
  }
}
