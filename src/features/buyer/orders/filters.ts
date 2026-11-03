import type { CheckStatus, OrderFilter, OrderSearch } from "@/features/orders/queries";
import type { OrderStatus } from "@/ui/ProgressSteps";

/** The chips on /buyer/orders, in display order. `to_check` is linked from Home. */
export const ORDER_LIST_FILTERS = ["all", "active", "to_check", "delivered", "problems", "closed"] as const;
export type OrderListFilter = (typeof ORDER_LIST_FILTERS)[number];

export const FILTER_LABELS: Record<OrderListFilter, string> = {
  all: "All",
  active: "Active",
  to_check: "To check",
  delivered: "Delivered",
  problems: "Problems",
  closed: "Cancelled and rejected",
};

/** Filters that list orders. Problems lists the issues the buyer reported instead. */
export type OrderRowFilter = Exclude<OrderListFilter, "problems">;

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilter(value: Param): OrderListFilter {
  const raw = first(value);
  return ORDER_LIST_FILTERS.find((filter) => filter === raw) ?? "all";
}

/** The order query each chip runs. */
export function orderQueryFor(filter: OrderRowFilter): Pick<OrderFilter, "statuses" | "toCheck"> {
  switch (filter) {
    case "active":
      return { statuses: ["pending", "accepted", "out_for_delivery"] };
    case "to_check":
      return { toCheck: true };
    case "delivered":
      return { statuses: ["delivered"] };
    case "closed":
      return { statuses: ["cancelled", "rejected"] };
    case "all":
      return {};
  }
}

/** Out for delivery, or delivered and not yet checked: the buyer should check it (BUY-09). */
export function needsCheck(order: { status: OrderStatus; checkStatus: CheckStatus }): boolean {
  return order.status === "out_for_delivery" || (order.status === "delivered" && order.checkStatus === "unchecked");
}

const MAX_SEARCH = 60;
const ORDER_NUMBER = /^(?:ord[\s-]*|#)?(\d{1,9})$/i;

/**
 * "ORD-1044", "ord 1044", "#1044" or "1044" search by order number; anything else by supplier name.
 * Characters outside letters, digits, spaces and & ' . - are dropped, so the text is safe in a LIKE pattern.
 */
export function parseSearch(value: Param): OrderSearch | null {
  const raw = (first(value) ?? "").trim().slice(0, MAX_SEARCH);
  const number = ORDER_NUMBER.exec(raw)?.[1];
  if (number !== undefined) return { kind: "number", number: Number(number) };
  const text = raw
    .replace(/[^\p{L}\p{N}\s&'.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? { kind: "supplier", text } : null;
}

export const PAGE_SIZE = 20;
export const MAX_SHOWN = 300;

/** How many rows to show: a multiple of the page size, from the `show` parameter. */
export function shownFrom(value: Param): number {
  const requested = Number(first(value));
  if (!Number.isInteger(requested) || requested < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(MAX_SHOWN, Math.ceil(requested / PAGE_SIZE) * PAGE_SIZE);
}

/** A /buyer/orders link that keeps the search; the default filter and page size are left out. */
export function ordersHref({ filter, q, show }: { filter: OrderListFilter; q?: string; show?: number }): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (q) params.set("q", q);
  if (show !== undefined && show > PAGE_SIZE) params.set("show", String(show));
  const query = params.toString();
  return query ? `/buyer/orders?${query}` : "/buyer/orders";
}
