import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { BackLink, OrgStatusPill, ProfileList, SectionHead } from "@/features/admin/components/Layout";
import { summariseOrders } from "@/features/admin/orderStats";
import { isUuid } from "@/features/admin/params";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisation, getTradingHours } from "@/features/admin/queries/organisations";
import { OrderCard } from "@/features/orders/OrderCard";
import { getOrders } from "@/features/orders/queries";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { Panel } from "@/ui/Panel";
import { RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Buyer details" };

const ORDER_LIMIT = 100;

export default async function BuyerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const buyer = await getOrganisation(id, "buyer");
  if (!buyer) notFound();

  const [tradingHours, orders, orderRows] = await Promise.all([
    getTradingHours(id),
    getOrders({ buyerOrgId: id, limit: ORDER_LIMIT }),
    getOrderStatRows({ buyerOrgId: id }),
  ]);
  const stats = summariseOrders(orderRows);

  return (
    <>
      <BackLink href="/admin/users">Back to users</BackLink>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <BusinessLogo name={buyer.name} size={48} />
        <h1 className="break-words">{buyer.name}</h1>
        <OrgStatusPill status={buyer.status} />
      </div>
      <Panel title="Buyer details">
        <ProfileList
          rows={[
            ["Contact person", buyer.contactName ?? "Not given"],
            ["Phone", buyer.phone ?? "Not given"],
            ["Email", buyer.email ?? "Not given"],
            ["Address", buyer.address ?? "Not given"],
            ["Trading hours", tradingHours ?? "Not given"],
            ["Joined", buyer.joinedAt ? formatDateTime(buyer.joinedAt) : "Not joined yet"],
            ["Orders", String(stats.orders)],
            ["Open orders", String(stats.open)],
            ["Order value", formatMoney(stats.valueCents)],
          ]}
        />
      </Panel>

      <SectionHead>Orders</SectionHead>
      {orders.length === 0 ? (
        <EmptyState>No orders yet.</EmptyState>
      ) : (
        <RecordList>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} viewer="admin" />
          ))}
        </RecordList>
      )}
      {stats.orders > orders.length ? (
        <p className="text-[.84rem] text-muted">
          Showing the latest {orders.length} of {stats.orders} orders. Search All orders by order number for an older one.
        </p>
      ) : null}
    </>
  );
}
