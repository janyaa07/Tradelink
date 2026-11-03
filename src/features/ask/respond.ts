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
  readLineStatus,
  reliabilityText,
  restockText,
  spendText,
  textReply,
} from "@/domain/ask/replies";
import { bestRecord } from "@/domain/ask/supplier-record";
import type { AskReply, AskTurn, ReviewLine } from "@/domain/ask/types";
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

async function restockReply(orgId: string): Promise<AskReply> {
  const plan = await getRestockPlan(orgId);
  if (plan.rows.length === 0) return textReply(ASK_COPY.enoughStock);
  return {
    text: restockText(plan.rows.length),
    cards: [
      {
        kind: "plan",
        items: plan.rows.map((row) => ({ name: row.item.name, daysLeft: `${formatDaysLeft(row.daysLeft)} days left` })),
      },
    ],
    actions: [{ kind: "load_plan" }],
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
  return {
    text: priceText(item),
    cards: [
      {
        kind: "price",
        price: {
          supplierName: item.supplierName,
          available: availabilityLabel(item),
          lastPaid: lastPaid ? formatMoney(lastPaid) : null,
        },
      },
    ],
    actions: [],
  };
}

function toReviewLine(line: DraftLine): ReviewLine[] {
  const productId = line.productId ?? line.options[0];
  if (!productId) return [];
  return [
    {
      productId,
      qty: line.qty,
      sourceText: line.sourceText,
      options: line.options,
      state: line.state === "matched" ? "manual" : "suggested",
    },
  ];
}

/** "Here is what I read. Nothing has been sent." when at least one line matched or has options (BUY-49). */
function readOrderReply(lines: DraftLine[], catalogue: CatalogueItem[]): AskReply | null {
  const review = lines.flatMap(toReviewLine);
  if (review.length === 0) return null;
  const names = new Map(catalogue.map((item) => [item.id, item.name]));
  return {
    text: ASK_COPY.readOrder,
    cards: [
      {
        kind: "read",
        lines: lines.map((line) => {
          const name = line.productId ? names.get(line.productId) : undefined;
          return { label: name ? `${line.qty} × ${name}` : line.sourceText, status: readLineStatus(line.state) };
        }),
      },
    ],
    actions: [{ kind: "review_order", lines: review }],
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

/** Answers one Ask message for the signed-in buyer; every query runs as the user, so RLS applies. */
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
      return { text: ASK_COPY.usual, cards: [], actions: [{ kind: "load_usual" }] };
    case "reliability":
      return reliabilityReply(session.orgId);
    case "price":
      return priceReply(session.orgId, intent.query);
    case "none":
      return unmatchedReply(session, message, history);
  }
}
