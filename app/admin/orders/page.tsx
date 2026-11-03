import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { CellLink } from "@/features/admin/components/Rows";
import { summariseOrders } from "@/features/admin/orderStats";
import { listHref, ORDER_STATUS_OPTIONS, param, parseOrderNumber, parseOrderStatus, type SearchParams } from "@/features/admin/params";
import { findOrderScope, getOrderStatRows } from "@/features/admin/queries/orders";
import { OrderCard, StatusPill } from "@/features/orders/OrderCard";
import { countOrders, getOrders, type OrderView } from "@/features/orders/queries";
import { Cell, DataTable, Row } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { formatDate, formatDateTime, orderNumber } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, PageHeader, SearchBox } from "@/ui/PageHeader";
import { Pill } from "@/ui/Pill";
import type { OrderStatus } from "@/ui/ProgressSteps";
import { RecordList } from "@/ui/RecordCard";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "All orders" };

const LIMIT = 500;

const COLUMNS = [
  { label: "Order", className: "w-32" },
  { label: "Buyer" },
  { label: "Supplier" },
  { label: "Items" },
  { label: "Delivery", className: "w-28" },
  { label: "Total", align: "right" as const, className: "w-28" },
  { label: "Status", className: "w-40" },
];

/** Newest first. A searched number is looked up exactly, however old the order is. */
async function loadOrders(status: OrderStatus | null, number: number | null | undefined): Promise<OrderView[]> {
  if (number === undefined) return getOrders({ statuses: status ? [status] : undefined, limit: LIMIT });
  if (number === null) return [];
  const scope = await findOrderScope(number);
  if (!scope || (status && scope.status !== status)) return [];
  const orders = await getOrders({
    buyerOrgId: scope.buyerOrgId,
    supplierOrgId: scope.supplierOrgId,
    statuses: [scope.status],
    limit: LIMIT,
  });
  return orders.filter((order) => order.number === number);
}

/** "2 items: Jasmine rice 5kg, Soy sauce 1L" with at most two names. */
function itemSummary(order: OrderView): string {
  const names = order.lines.map((line) => line.name);
  const count = `${names.length} ${names.length === 1 ? "item" : "items"}`;
  const shown = names.slice(0, 2).join(", ");
  const more = names.length > 2 ? ` and ${names.length - 2} more` : "";
  return names.length ? `${count}: ${shown}${more}` : count;
}

/** A business in a cell, linked to its admin page when it is still connected. */
function Business({ org, kind }: { org: OrderView["buyer"]; kind: "buyer" | "supplier" }) {
  if (!org.id) return <span className="text-muted">{org.name}</span>;
  return <CellLink href={kind === "buyer" ? `/admin/users/buyers/${org.id}` : `/admin/suppliers/${org.id}`}>{org.name}</CellLink>;
}

function OrderState({ order }: { order: OrderView }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusPill status={order.status} />
      {order.checkStatus === "all_here" ? <Pill tone="good">All here</Pill> : null}
      {order.checkStatus === "problem" ? <Pill tone="warn">Problem reported</Pill> : null}
    </span>
  );
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const params = await searchParams;
  const status = parseOrderStatus(param(params, "status"));
  const search = (param(params, "q") ?? "").trim().slice(0, 40);
  const number = parseOrderNumber(search);
  const searching = search.length > 0;

  const [shown, statRows, problems] = await Promise.all([
    loadOrders(status, searching ? number : undefined),
    getOrderStatRows(),
    countOrders({ checkStatuses: ["problem"] }),
  ]);
  const stats = summariseOrders(statRows);
  const pending = statRows.filter((row) => row.status === "pending").length;
  const filtered = status !== null || searching;
  const href = (next: { status?: string | null; q?: string }) => listHref("/admin/orders", { status: next.status, q: next.q });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="All orders"
        description="Every order on the platform, newest first. Open a buyer or supplier to see their side."
        actions={
          <SearchBox
            action="/admin/orders"
            label="Order number"
            placeholder="Order number, such as ORD-1044"
            defaultValue={search}
            keep={{ status: status ?? undefined }}
          />
        }
      />

      <Tiles
        items={[
          { label: "Open orders", value: stats.open },
          { label: "Open order value", value: formatMoney(stats.openValueCents) },
          { label: "Waiting for the supplier", value: pending },
          { label: "Problems reported", value: problems, alert: problems > 0 },
        ]}
      />

      <FilterTabs
        label="Show orders"
        tabs={[
          { href: href({ q: search }), label: "All", count: searching ? undefined : statRows.length, current: status === null },
          ...ORDER_STATUS_OPTIONS.map((option) => ({
            href: href({ status: option.value, q: search }),
            label: option.label,
            count: searching ? undefined : statRows.filter((row) => row.status === option.value).length,
            current: option.value === status,
          })),
        ]}
      />

      {searching ? (
        <p className="flex flex-wrap items-center gap-x-3 text-[.84rem] text-muted">
          {number === null ? (
            <span role="alert" className="font-semibold text-bad">
              Enter an order number, such as ORD-1044.
            </span>
          ) : (
            <span>
              Results for <b className="text-ink">{search}</b>
            </span>
          )}
          <LinkButton variant="text" href={href({ status })}>
            Clear search
          </LinkButton>
        </p>
      ) : null}
      {shown.length === LIMIT ? (
        <p className="text-[.84rem] text-muted">Showing the latest {LIMIT} orders. Search by order number to find an older one.</p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <LinkButton href="/admin/orders" variant="text">
                Clear filters
              </LinkButton>
            ) : null
          }
        >
          {filtered ? "No orders match these filters." : "No orders yet."}
        </EmptyState>
      ) : (
        <DataTable
          label="Orders"
          columns={COLUMNS}
          phone={
            <RecordList>
              {shown.map((order) => (
                <OrderCard key={order.id} order={order} viewer="admin" />
              ))}
            </RecordList>
          }
        >
          {shown.map((order) => {
            const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
            return (
              <Row key={order.id}>
                <Cell num>
                  <span className="block font-semibold">{orderNumber(order.number)}</span>
                  <span className="block text-[.78rem] text-muted">{formatDateTime(order.createdAt)}</span>
                </Cell>
                <Cell>
                  <Business org={order.buyer} kind="buyer" />
                </Cell>
                <Cell>
                  <Business org={order.supplier} kind="supplier" />
                </Cell>
                <Cell muted className="max-w-[15rem]">
                  <span className="block truncate" title={order.lines.map((line) => `${line.qty} × ${line.name}`).join(", ")}>
                    {itemSummary(order)}
                  </span>
                  {order.lines.some((line) => !line.held) ? (
                    <span className="block text-[.72rem] font-semibold text-warn">Stock and price to confirm</span>
                  ) : null}
                </Cell>
                <Cell num>{delivery ? formatDate(delivery) : "—"}</Cell>
                <Cell num strong align="right">
                  {formatMoney(order.totalCents)}
                </Cell>
                <Cell>
                  <OrderState order={order} />
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
