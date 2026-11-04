import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import {
  FILTER_LABELS,
  MAX_SHOWN,
  ORDER_LIST_FILTERS,
  PAGE_SIZE,
  orderQueryFor,
  ordersHref,
  parseFilter,
  needsCheck,
  parseSearch,
  shownFrom,
  type OrderListFilter,
} from "@/features/buyer/orders/filters";
import { OrderRow, ProblemRow, RowList } from "@/features/buyer/orders/OrderRows";
import { RestPill } from "@/features/buyer/orders/rest";
import { countBuyerIssues, getBuyerIssues } from "@/features/buyer/orders/queries";
import { getMinimums, orderBelowMinimum } from "@/features/buyer/orders/minimum";
import { creditBanner, ISSUE_STATUS_PILLS, itemSummary, problemSummary, waitingBanner } from "@/features/buyer/orders/summary";
import { StatusPill } from "@/features/orders/OrderCard";
import { countOrders, getOrders, type OrderSearch, type OrderView } from "@/features/orders/queries";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Cell, DataTable, Row, RowLink } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { formatDate, formatDateTime, orderNumber } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, Notice, PageHeader, SearchBox } from "@/ui/PageHeader";
import { Pill } from "@/ui/Pill";

export const metadata: Metadata = { title: "Orders · Tradelink" };

const EMPTY: Record<OrderListFilter, string> = {
  all: "No orders yet. Orders you place show here.",
  active: "No active orders. Orders show here until they are delivered.",
  to_check: "Nothing to check. Deliveries show here while they are on the way.",
  delivered: "No delivered orders yet.",
  problems: "No problems reported. If a delivery is short, damaged or wrong, report it from the order.",
  closed: "No cancelled or rejected orders.",
};

/** What the buyer has to do about an order comes before where it is. */
function OrderState({ order }: { order: OrderView }) {
  if (needsCheck(order)) return <Pill tone="warn">Check delivery</Pill>;
  if (order.checkStatus === "problem") return <Pill tone="bad">Problem reported</Pill>;
  return <StatusPill status={order.status} />;
}

const ORDER_COLUMNS = [
  { label: "Order", className: "w-28" },
  { label: "Supplier" },
  { label: "Items" },
  { label: "Delivery", className: "w-28" },
  { label: "Total", align: "right" as const, className: "w-28" },
  { label: "Status", className: "w-40" },
];

const PROBLEM_COLUMNS = [
  { label: "Problem" },
  { label: "Order", className: "w-28" },
  { label: "Supplier" },
  { label: "Reported", className: "w-40" },
  { label: "Status", className: "w-44" },
];

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

  const [counts, waiting, credits, orders, issues] = await Promise.all([
    Promise.all(ORDER_LIST_FILTERS.map((chip) => countFor(chip, session.orgId, search))),
    countBuyerIssues({ orgId: session.orgId, openOnly: true }),
    countBuyerIssues({ orgId: session.orgId, creditOnly: true }),
    filter === "problems" ? Promise.resolve([]) : getOrders({ buyerOrgId: session.orgId, search, ...orderQueryFor(filter), limit: shown + 1 }),
    filter === "problems" ? getBuyerIssues({ orgId: session.orgId, search, limit: shown + 1 }) : Promise.resolve([]),
  ]);
  const rows = filter === "problems" ? issues.length : orders.length;
  const minimums = await getMinimums(orders.map((order) => order.supplier.id));
  const hasMore = rows > shown && shown < MAX_SHOWN;

  const more = hasMore ? (
    <LinkButton href={ordersHref({ filter, q, show: shown + PAGE_SIZE })} scroll={false} variant="text">
      Show more
    </LinkButton>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Orders"
        description="Everything you ordered, newest first. Open one to check a delivery or report a problem."
        actions={
          <>
            <SearchBox
              action="/buyer/orders"
              label="Order number or supplier"
              placeholder="Order number or supplier"
              defaultValue={q}
              keep={{ filter: filter === "all" ? undefined : filter }}
            />
            <span className="hidden rail:block">
              <LinkButton href="/buyer/products" variant="primary">
                New order
              </LinkButton>
            </span>
          </>
        }
      />

      {credits > 0 && filter !== "problems" ? (
        <Notice tone="warn" title={creditBanner(credits)} href={ordersHref({ filter: "problems" })} action="Confirm">
          A supplier promised a credit. Tell them once it has reached you, so the problem can close.
        </Notice>
      ) : null}
      {waiting > 0 && filter !== "problems" ? <Notice tone="warn" title={waitingBanner(waiting)} href={ordersHref({ filter: "problems" })} /> : null}

      <FilterTabs
        label="Show orders"
        tabs={ORDER_LIST_FILTERS.map((tab, index) => ({
          href: ordersHref({ filter: tab, q }),
          label: FILTER_LABELS[tab],
          count: counts[index],
          current: tab === filter,
        }))}
      />
      {filter === "problems" ? (
        <p className="text-[.84rem] text-muted">
          Problems you reported on a delivery. The supplier answers with a credit, a replacement or an update.
        </p>
      ) : null}
      {q ? (
        <p className="flex flex-wrap items-center gap-x-3 text-[.84rem] text-muted">
          <span>
            Results for <b className="text-ink">{q}</b>
          </span>
          <LinkButton variant="text" href={ordersHref({ filter })}>
            Clear search
          </LinkButton>
        </p>
      ) : null}

      {rows === 0 ? (
        <EmptyState
          action={
            filter === "all" && !q ? (
              <LinkButton href="/buyer/products" variant="primary">
                New order
              </LinkButton>
            ) : null
          }
        >
          {q ? `Nothing matches "${q}" here.` : EMPTY[filter]}
        </EmptyState>
      ) : filter === "problems" ? (
        <DataTable
          label="Problems"
          columns={PROBLEM_COLUMNS}
          footer={more}
          phone={
            <RowList label="Problems">
              {issues.slice(0, shown).map((issue) => (
                <ProblemRow key={issue.id} issue={issue} />
              ))}
            </RowList>
          }
        >
          {issues.slice(0, shown).map((issue) => {
            const pill = ISSUE_STATUS_PILLS[issue.status];
            return (
              <Row key={issue.id}>
                <Cell>
                  <RowLink href={`/buyer/orders/${issue.orderId}#problems`}>{problemSummary(issue)}</RowLink>
                </Cell>
                <Cell num>{orderNumber(issue.orderNumber)}</Cell>
                <Cell>{issue.supplierName}</Cell>
                <Cell num muted>
                  {formatDateTime(issue.createdAt)}
                </Cell>
                <Cell>
                  <Pill tone={pill.tone}>{pill.label}</Pill>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      ) : (
        <DataTable
          label="Orders"
          columns={ORDER_COLUMNS}
          footer={more}
          phone={
            <RowList label="Orders">
              {orders.slice(0, shown).map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </RowList>
          }
        >
          {orders.slice(0, shown).map((order) => {
            const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
            return (
              <Row key={order.id}>
                <Cell num>
                  <RowLink href={`/buyer/orders/${order.id}`}>{orderNumber(order.number)}</RowLink>
                </Cell>
                <Cell>
                  <span className="flex items-center gap-2.5">
                    <BusinessLogo name={order.supplier.name} seedKey={order.supplier.id || undefined} size={24} />
                    <span className="truncate">{order.supplier.name}</span>
                  </span>
                </Cell>
                <Cell muted className="max-w-[16rem] truncate">
                  {itemSummary(order.lines.map((line) => line.name)).names}
                </Cell>
                <Cell num>{delivery ? formatDate(delivery) : "—"}</Cell>
                <Cell num strong align="right">
                  {formatMoney(order.totalCents + order.laterCents)}
                </Cell>
                <Cell>
                  <span className="flex flex-wrap items-center gap-1">
                    <OrderState order={order} />
                    <RestPill order={order} />
                    {orderBelowMinimum(order, minimums) > 0 ? <Pill tone="warn">Below minimum</Pill> : null}
                  </span>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
      {more ? <div className="self-center rail:hidden">{more}</div> : null}
    </div>
  );
}
