import type { OrderLineView, OrderView } from "@/features/orders/queries";
import { formatDate } from "@/ui/format";
import type { OrderStatus } from "@/ui/ProgressSteps";
import { addDays } from "./dates";

/** The supplier's order tabs, in the order they show. All includes rejected and cancelled orders. */
export const SUPPLIER_ORDER_TABS = ["new", "to_pack", "out", "delivered", "all"] as const;
export type SupplierOrderTab = (typeof SUPPLIER_ORDER_TABS)[number];

export const ORDER_TAB_LABELS: Record<SupplierOrderTab, string> = {
  new: "New",
  to_pack: "To pack",
  out: "Out for delivery",
  delivered: "Delivered",
  all: "All",
};

/** The statuses each tab shows; All has no status filter. */
export const ORDER_TAB_STATUSES: Record<SupplierOrderTab, OrderStatus[] | undefined> = {
  new: ["pending"],
  to_pack: ["accepted"],
  out: ["out_for_delivery"],
  delivered: ["delivered"],
  all: undefined,
};

/** All is the default, so links to an order such as /supplier/orders#order-1066 always find it. */
export function parseOrderTab(value: string): SupplierOrderTab {
  return SUPPLIER_ORDER_TABS.find((tab) => tab === value) ?? "all";
}

export function inOrderTab(order: Pick<OrderView, "status">, tab: SupplierOrderTab): boolean {
  const statuses = ORDER_TAB_STATUSES[tab];
  return !statuses || statuses.includes(order.status);
}

/** An order number such as 1066 or ORD-1066, or part of a buyer's name. */
export type SupplierOrderSearch = { kind: "number"; number: number } | { kind: "buyer"; text: string };

export function parseSupplierSearch(value: string): SupplierOrderSearch | null {
  const text = value.trim().slice(0, 60);
  if (!text) return null;
  const number = /^(?:ord-?\s*)?(\d{1,9})$/i.exec(text)?.[1];
  if (number) return { kind: "number", number: Number(number) };
  return { kind: "buyer", text: text.toLowerCase() };
}

export function matchesBuyer(order: Pick<OrderView, "buyer">, text: string): boolean {
  return order.buyer.name.toLowerCase().includes(text.toLowerCase());
}

/** The Orders URL for a tab and search; the default tab and an empty search are left out. */
export function supplierOrdersHref({ tab = "all", q = "" }: { tab?: SupplierOrderTab; q?: string }): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("filter", tab);
  if (q.trim()) params.set("q", q.trim());
  const query = params.toString();
  return query ? `/supplier/orders?${query}` : "/supplier/orders";
}

/** The confirmed delivery date, else the one the buyer asked for, as "2026-11-04". */
export function deliveryDateOf(order: Pick<OrderView, "confirmedDeliveryDate" | "requestedDeliveryDate">): string | null {
  return (order.confirmedDeliveryDate ?? order.requestedDeliveryDate)?.slice(0, 10) ?? null;
}

/** "Today", "Tomorrow" or "Thu 5 Nov"; a dash when there is no date. */
export function deliveryLabel(date: string | null, today: string): string {
  if (!date) return "—";
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return formatDate(date);
}

/** "12 × Coconut milk 400ml, 4 × Dried chillies 500g" for the Items column. */
export function linesSummary(lines: Pick<OrderLineView, "qty" | "name">[]): string {
  return lines.map((line) => `${line.qty} × ${line.name}`).join(", ");
}

/** "Rest on Mon 9 Nov" while the rest of a part-accepted order is still to arrive; null otherwise. */
export function restLabel(order: Pick<OrderView, "later">): string | null {
  const later = order.later;
  if (!later || (later.status !== "waiting" && later.status !== "out_for_delivery")) return null;
  return `Rest on ${formatDate(later.date)}`;
}
