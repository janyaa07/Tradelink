import { availabilityLabel } from "@/domain/ask/replies";
import { numberFacts, type Fact } from "@/domain/ask/prompt";
import type { SupplierRecord } from "@/domain/ask/supplier-record";
import type { OrderCardData } from "@/domain/ask/types";
import { plural, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, type Cents } from "@/domain/money";
import { formatDaysLeft } from "@/domain/restock";
import { formatDate, orderNumber } from "@/ui/format";
import type { OrderStatus } from "@/ui/ProgressSteps";

const MAX_ORDERS = 10;
const MAX_ORDER_ITEMS = 8;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type FactSources = {
  businessName: string;
  spentCents: Cents;
  budgetCents: Cents;
  openOrders: OrderCardData[];
  plan: { name: string; daysLeft: number; qty: number; unit: string }[];
  products: { item: CatalogueItem; lastPaid: string | null }[];
  suppliers: SupplierRecord[];
};

function spendFact(spentCents: Cents, budgetCents: Cents): string {
  const difference =
    spentCents > budgetCents
      ? `${formatMoney(spentCents - budgetCents)} over budget`
      : `${formatMoney(budgetCents - spentCents)} left`;
  return `Spend this week (since Monday, Singapore time): ${formatMoney(spentCents)} of a ${formatMoney(budgetCents)} weekly budget, ${difference}.`;
}

function orderFact(order: OrderCardData): string {
  const items = order.lines
    .slice(0, MAX_ORDER_ITEMS)
    .map((line) => `${line.qty} × ${line.name}`)
    .join(", ");
  const more = order.lines.length > MAX_ORDER_ITEMS ? ` and ${order.lines.length - MAX_ORDER_ITEMS} more` : "";
  const delivery = order.deliveryDate ? `, delivery ${formatDate(order.deliveryDate)}` : "";
  return `Open order ${orderNumber(order.number)} from ${order.supplierName}: ${STATUS_LABELS[order.status]}${delivery}, total ${formatMoney(order.totalCents)}. Items: ${items}${more}.`;
}

function priceFact({ item, lastPaid }: FactSources["products"][number]): string {
  const paid = lastPaid ? ` You last paid ${formatMoney(lastPaid)}.` : "";
  return `Price: ${item.name} from ${item.supplierName} is ${formatMoney(item.price)} per ${item.unit}. Availability: ${availabilityLabel(item)}.${paid}`;
}

function supplierFact(record: SupplierRecord): string {
  return `Supplier record: ${record.name} delivered ${record.onTime} of ${record.delivered} delivered orders on time (${record.percent}% on time).`;
}

/** Read-only facts about the buyer's own business, numbered F1, F2 and so on, for an open question. */
export function buildFacts(sources: FactSources): Fact[] {
  const texts = [
    `Business: ${sources.businessName}. Ask can only see this business's orders and prices.`,
    spendFact(sources.spentCents, sources.budgetCents),
  ];
  if (sources.openOrders.length === 0) texts.push("Open orders: none.");
  texts.push(...sources.openOrders.slice(0, MAX_ORDERS).map(orderFact));
  if (sources.plan.length === 0) texts.push("Ready for tomorrow: no usual items will run out in the next few days.");
  texts.push(
    ...sources.plan.map(
      (row) => `Running low: ${row.name}, ${formatDaysLeft(row.daysLeft)} days left; suggested order ${plural(row.qty, row.unit)}.`,
    ),
  );
  texts.push(...sources.products.map(priceFact));
  if (sources.suppliers.length === 0) texts.push("Supplier record: no delivered orders yet.");
  texts.push(...sources.suppliers.map(supplierFact));
  return numberFacts(texts);
}
