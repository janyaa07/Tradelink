import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { countOrders, getOrders, OPEN_STATUSES, type OrderView } from "@/features/orders/queries";
import { defaultDeliveryDate, todayInSingapore } from "@/features/supplier/dates";
import { HashTarget } from "@/features/supplier/HashTarget";
import { IssueRow } from "@/features/supplier/IssueRow";
import { newIdempotencyKey } from "@/features/supplier/keys";
import {
  deliveryDateOf,
  inOrderTab,
  matchesBuyer,
  ORDER_TAB_LABELS,
  ORDER_TAB_STATUSES,
  parseOrderTab,
  parseSupplierSearch,
  SUPPLIER_ORDER_TABS,
  supplierOrdersHref,
  type SupplierOrderSearch,
  type SupplierOrderTab,
} from "@/features/supplier/orderFilters";
import { getBusinessProfile, getOpenIssues } from "@/features/supplier/queries";
import { SupplierOrderList } from "@/features/supplier/SupplierOrderList";
import { SupplierOrderTable } from "@/features/supplier/SupplierOrderTable";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, PageHeader, SearchBox } from "@/ui/PageHeader";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Orders · Tradelink" };

const LIMIT = 100;

const EMPTY: Record<SupplierOrderTab, string> = {
  new: "No new orders. Orders your buyers place show here first.",
  to_pack: "Nothing to pack. Accepted orders show here until they go out.",
  out: "No orders out for delivery.",
  delivered: "No delivered orders yet.",
  all: "No orders yet. Orders your buyers place show here.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstParam(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim().slice(0, 60);
}

/**
 * The tab's orders and every tab's count. An order number is searched in the database; part of a
 * buyer's name is matched against the newest orders, since the order search only knows supplier names.
 */
async function loadOrders(orgId: string, tab: SupplierOrderTab, search: SupplierOrderSearch | null) {
  if (search?.kind === "buyer") {
    const matched = (await getOrders({ supplierOrgId: orgId, limit: 200 })).filter((order) => matchesBuyer(order, search.text));
    return {
      orders: matched.filter((order) => inOrderTab(order, tab)).slice(0, LIMIT),
      counts: SUPPLIER_ORDER_TABS.map((each) => matched.filter((order) => inOrderTab(order, each)).length),
    };
  }
  const number = search ?? undefined;
  const [orders, counts] = await Promise.all([
    getOrders({ supplierOrgId: orgId, statuses: ORDER_TAB_STATUSES[tab], search: number, limit: LIMIT }),
    Promise.all(SUPPLIER_ORDER_TABS.map((each) => countOrders({ supplierOrgId: orgId, statuses: ORDER_TAB_STATUSES[each], search: number }))),
  ]);
  return { orders, counts };
}

function openTiles(open: OrderView[], today: string, problems: number) {
  return [
    { label: "New orders", value: open.filter((order) => order.status === "pending").length },
    { label: "Due today", value: open.filter((order) => deliveryDateOf(order) === today).length },
    { label: "Open order value", value: formatMoney(open.reduce((total, order) => total + order.totalCents, 0)) },
    { label: "Problems to answer", value: problems, alert: problems > 0 },
  ];
}

export default async function SupplierOrdersPage({ searchParams }: Props) {
  const session = await requireRole("supplier");
  const params = await searchParams;
  const tab = parseOrderTab(firstParam(params.filter));
  const q = firstParam(params.q);
  const search = parseSupplierSearch(q);
  const now = new Date();
  const today = todayInSingapore(now);

  const [{ orders, counts }, open, issues, profile] = await Promise.all([
    loadOrders(session.orgId, tab, search),
    getOrders({ supplierOrgId: session.orgId, statuses: OPEN_STATUSES, limit: 200 }),
    getOpenIssues(session.orgId),
    getBusinessProfile(session.orgId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <HashTarget />
      <PageHeader
        title="Orders"
        description={`Orders from your buyers, newest first. Order cut-off is ${profile.cutoff.slice(0, 5)}.`}
        actions={
          <SearchBox
            action="/supplier/orders"
            label="Order number or buyer"
            placeholder="Order number or buyer"
            defaultValue={q}
            keep={{ filter: tab === "all" ? undefined : tab }}
          />
        }
      />

      {issues.length > 0 ? (
        <section id="problems" aria-labelledby="problems-title" className="scroll-mt-4 rounded-xl border border-bad/30 bg-surface shadow-card">
          <h2 id="problems-title" className="sr-only">
            Problems to answer
          </h2>
          <ul>
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} idemKey={newIdempotencyKey()} />
            ))}
          </ul>
        </section>
      ) : null}

      <Tiles items={openTiles(open, today, issues.length)} />

      <section id="orders" aria-labelledby="orders-title" className="flex scroll-mt-4 flex-col gap-3">
        <h2 id="orders-title" className="sr-only">
          Orders
        </h2>
        <FilterTabs
          label="Show orders"
          tabs={SUPPLIER_ORDER_TABS.map((each, index) => ({
            href: supplierOrdersHref({ tab: each, q }),
            label: ORDER_TAB_LABELS[each],
            count: counts[index],
            current: each === tab,
          }))}
        />
        {q ? (
          <p className="flex flex-wrap items-center gap-x-3 text-[.84rem] text-muted">
            <span>
              Results for <b className="text-ink">{q}</b>
            </span>
            <LinkButton variant="text" href={supplierOrdersHref({ tab })}>
              Clear search
            </LinkButton>
          </p>
        ) : null}
        {orders.length === 0 ? (
          <EmptyState>{q ? `Nothing matches "${q}" here.` : EMPTY[tab]}</EmptyState>
        ) : (
          <SupplierOrderTable
            key={tab}
            rows={orders.map((order) => ({
              order,
              idemKey: newIdempotencyKey(),
              defaultDate: defaultDeliveryDate(order.requestedDeliveryDate, now),
            }))}
            today={today}
            pickAll={tab === "to_pack"}
            note={orders.length === LIMIT ? `Showing the newest ${LIMIT}. Search by order number to find an older one.` : undefined}
            phone={<SupplierOrderList orders={orders} now={now} empty={EMPTY[tab]} />}
          />
        )}
      </section>
    </div>
  );
}
