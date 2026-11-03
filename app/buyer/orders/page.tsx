import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requireRole } from "@/data/session";
import {
  FILTER_LABELS,
  MAX_SHOWN,
  ORDER_LIST_FILTERS,
  PAGE_SIZE,
  orderQueryFor,
  ordersHref,
  parseFilter,
  parseSearch,
  shownFrom,
  type OrderListFilter,
} from "@/features/buyer/orders/filters";
import { OrderRow, ProblemRow, RowList } from "@/features/buyer/orders/OrderRows";
import { countBuyerIssues, getBuyerIssues } from "@/features/buyer/orders/queries";
import { waitingBanner } from "@/features/buyer/orders/summary";
import { countOrders, getOrders, type OrderSearch } from "@/features/orders/queries";
import { Chip, ChipRow } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { Icon } from "@/ui/Icon";
import { LinkButton } from "@/ui/LinkButton";

export const metadata: Metadata = { title: "Orders · Tradelink" };

const EMPTY: Record<OrderListFilter, string> = {
  all: "No orders yet. Orders you place show here.",
  active: "No active orders. Orders show here until they are delivered.",
  to_check: "Nothing to check. Deliveries show here while they are on the way.",
  delivered: "No delivered orders yet.",
  problems: "No problems reported. If a delivery is short, damaged or wrong, report it from the order.",
  closed: "No cancelled or rejected orders.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstParam(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim().slice(0, 60);
}

async function countFor(filter: OrderListFilter, orgId: string, search: OrderSearch | undefined): Promise<number> {
  if (filter === "problems") return countBuyerIssues({ orgId, search });
  return countOrders({ buyerOrgId: orgId, search, ...orderQueryFor(filter) });
}

export default async function BuyerOrdersPage({ searchParams }: Props) {
  const session = await requireRole("buyer");
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const q = firstParam(params.q);
  const search = parseSearch(q) ?? undefined;
  const shown = shownFrom(params.show);

  const [counts, waiting, orders, issues] = await Promise.all([
    Promise.all(ORDER_LIST_FILTERS.map((chip) => countFor(chip, session.orgId, search))),
    countBuyerIssues({ orgId: session.orgId, openOnly: true }),
    filter === "problems"
      ? Promise.resolve([])
      : getOrders({ buyerOrgId: session.orgId, search, ...orderQueryFor(filter), limit: shown + 1 }),
    filter === "problems" ? getBuyerIssues({ orgId: session.orgId, search, limit: shown + 1 }) : Promise.resolve([]),
  ]);
  const rows = filter === "problems" ? issues.length : orders.length;
  const hasMore = rows > shown && shown < MAX_SHOWN;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rail:flex-row rail:items-end rail:justify-between">
        <h1>Orders</h1>
        <Form action="/buyer/orders" role="search" className="flex w-full items-center gap-2 rail:max-w-sm">
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <label htmlFor="order-search" className="sr-only">
            Order number or supplier
          </label>
          <span className="relative flex-1">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              key={q}
              id="order-search"
              type="search"
              name="q"
              defaultValue={q}
              maxLength={60}
              placeholder="Order number or supplier"
              className="min-h-10 w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[.92rem] text-ink placeholder:text-muted"
            />
          </span>
          <button type="submit" className="sr-only">
            Search orders
          </button>
        </Form>
      </header>

      {waiting > 0 && filter !== "problems" ? (
        <Link
          href={ordersHref({ filter: "problems" })}
          className="flex items-center justify-between gap-3 rounded-lg bg-warn-soft px-4 py-2.5 text-[.9rem] font-semibold text-warn no-underline hover:underline"
        >
          <span className="flex items-center gap-2">
            <Icon name="flag" size={18} />
            {waitingBanner(waiting)}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}

      <div className="flex flex-col gap-3">
        <ChipRow label="Show orders">
          {ORDER_LIST_FILTERS.map((chip, index) => (
            <Chip key={chip} href={ordersHref({ filter: chip, q })} selected={chip === filter}>
              {FILTER_LABELS[chip]}
              <span className="num ml-1.5 opacity-75">{counts[index]}</span>
            </Chip>
          ))}
        </ChipRow>
        {filter === "problems" ? (
          <p className="text-[.9rem] text-muted">
            Problems you reported on a delivery. The supplier answers with a credit, a replacement or an update.
          </p>
        ) : null}
        {q ? (
          <p className="flex flex-wrap items-center gap-x-3 text-[.9rem] text-muted">
            <span>
              Results for <b className="text-ink">{q}</b>
            </span>
            <LinkButton variant="text" href={ordersHref({ filter })}>
              Clear search
            </LinkButton>
          </p>
        ) : null}
      </div>

      <section aria-label={FILTER_LABELS[filter]} className="flex flex-col gap-4">
        {rows === 0 ? (
          <EmptyState
            action={
              filter === "all" && !q ? (
                <LinkButton href="/buyer/assistant" variant="primary">
                  New order
                </LinkButton>
              ) : null
            }
          >
            {q ? `Nothing matches "${q}" here.` : EMPTY[filter]}
          </EmptyState>
        ) : filter === "problems" ? (
          <RowList label="Problems">
            {issues.slice(0, shown).map((issue) => (
              <ProblemRow key={issue.id} issue={issue} />
            ))}
          </RowList>
        ) : (
          <RowList label="Orders">
            {orders.slice(0, shown).map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </RowList>
        )}
        {hasMore ? (
          <LinkButton href={ordersHref({ filter, q, show: shown + PAGE_SIZE })} scroll={false} className="self-center">
            Show more
          </LinkButton>
        ) : null}
      </section>
    </div>
  );
}
