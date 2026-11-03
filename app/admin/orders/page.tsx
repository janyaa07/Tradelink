import type { Metadata } from "next";
import Form from "next/form";
import { requireRole } from "@/data/session";
import { PageHead } from "@/features/admin/components/Layout";
import { ORDER_STATUS_OPTIONS, param, parseOrderNumber, parseOrderStatus, type SearchParams } from "@/features/admin/params";
import { OrderCard } from "@/features/orders/OrderCard";
import { findOrderScope } from "@/features/admin/queries/orders";
import { getOrders, type OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { SelectField, TextField } from "@/ui/Field";
import { LinkButton } from "@/ui/LinkButton";
import type { OrderStatus } from "@/ui/ProgressSteps";
import { RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "All orders" };

const LIMIT = 500;

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

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const params = await searchParams;
  const status = parseOrderStatus(param(params, "status"));
  const search = (param(params, "q") ?? "").trim().slice(0, 40);
  const number = parseOrderNumber(search);
  const searching = search.length > 0;

  const shown = await loadOrders(status, searching ? number : undefined);
  const filtered = status !== null || searching;

  return (
    <>
      <PageHead title="All orders" sub="Every order on the platform." />
      <Form action="/admin/orders" className="flex flex-wrap items-end gap-2.5" aria-label="Filter orders">
        <div className="w-full min-[480px]:w-52">
          <SelectField label="Status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-full min-[480px]:w-52">
          <TextField
            label="Order number"
            name="q"
            defaultValue={search}
            placeholder="ORD-1044"
            inputMode="search"
            autoComplete="off"
            error={searching && number === null ? "Enter an order number, such as ORD-1044." : undefined}
          />
        </div>
        <Button type="submit">Show orders</Button>
        {filtered ? (
          <LinkButton href="/admin/orders" variant="text" className="min-h-10">
            Clear filters
          </LinkButton>
        ) : null}
      </Form>
      {shown.length === LIMIT ? (
        <p className="text-[.84rem] text-muted">Showing the latest {LIMIT} orders. Search by order number to find an older one.</p>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState>{filtered ? "No orders match these filters." : "No orders yet."}</EmptyState>
      ) : (
        <RecordList>
          {shown.map((order) => (
            <OrderCard key={order.id} order={order} viewer="admin" />
          ))}
        </RecordList>
      )}
    </>
  );
}
