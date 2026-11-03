import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { BackLink, OrgStatusPill, ProfileList, SectionHead } from "@/features/admin/components/Layout";
import { SupplierStatusControl } from "@/features/admin/components/SupplierStatusControl";
import { deliveryDaysLabel, timeLabel } from "@/features/admin/labels";
import { summariseOrders } from "@/features/admin/orderStats";
import { isUuid } from "@/features/admin/params";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisation, getSupplierProfile, type Organisation, type SupplierProfile } from "@/features/admin/queries/organisations";
import { OrderCard } from "@/features/orders/OrderCard";
import { getOrders } from "@/features/orders/queries";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { Panel } from "@/ui/Panel";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { RecordCard, RecordList } from "@/ui/RecordCard";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Supplier" };

const ORDER_LIMIT = 100;

const HEALTH_PILL: Record<CatalogueItem["health"], { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  healthy: { label: "Healthy", tone: "good" },
  low: { label: "Low stock", tone: "warn" },
  out: { label: "Out of stock", tone: "bad" },
  unconfirmed: { label: "Stock unconfirmed", tone: "info" },
};

function leadTime(profile: SupplierProfile): string {
  const days = profile.leadTimeDays === 0 ? "Same day" : profile.leadTimeDays === 1 ? "1 day" : `${profile.leadTimeDays} days`;
  return profile.leadTimeNote ? `${days}, ${profile.leadTimeNote}` : days;
}

function profileRows(supplier: Organisation, profile: SupplierProfile | null): [string, string][] {
  const rows: [string, string][] = [
    ["Contact person", supplier.contactName ?? "Not given"],
    ["Phone", supplier.phone ?? "Not given"],
    ["Email", supplier.email ?? "Not given"],
    ["Address", supplier.address ?? "Not given"],
  ];
  if (profile) {
    rows.push(
      ["Product range", profile.productRange ?? "Not given"],
      ["Delivery days", deliveryDaysLabel(profile.deliveryDays)],
      ["Lead time", leadTime(profile)],
      ["Order cut-off", timeLabel(profile.cutoffTime)],
      ["Minimum order", formatMoney(Number(profile.minimumOrder).toFixed(2))],
      ["Bank account", profile.bankLast4 ? `Ending ${profile.bankLast4}` : "Not given"],
    );
  }
  rows.push(["Joined", supplier.joinedAt ? formatDateTime(supplier.joinedAt) : "Not joined yet"]);
  if (supplier.invitedBy) {
    rows.push(["Invited by", supplier.invitedBy], ["Invitation sent", formatDateTime(supplier.createdAt)]);
  }
  return rows;
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supplier = await getOrganisation(id, "supplier");
  if (!supplier) notFound();

  const [profile, products, orders, orderRows] = await Promise.all([
    getSupplierProfile(id),
    getCatalogue({ supplierOrgId: id }),
    getOrders({ supplierOrgId: id, limit: ORDER_LIMIT }),
    getOrderStatRows({ supplierOrgId: id }),
  ]);
  const stats = summariseOrders(orderRows);
  const low = products.filter((product) => product.health === "low" || product.health === "out").length;
  const canChangeStatus = supplier.status === "active" || supplier.status === "suspended";

  return (
    <>
      <BackLink href="/admin/suppliers">Back to suppliers</BackLink>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <BusinessLogo name={supplier.name} size={48} />
          <h1 className="break-words">{supplier.name}</h1>
          <OrgStatusPill status={supplier.status} />
        </div>
        {canChangeStatus ? (
          <SupplierStatusControl
            orgId={supplier.id}
            name={supplier.name}
            status={supplier.status === "active" ? "active" : "suspended"}
            idempotencyKey={crypto.randomUUID()}
          />
        ) : null}
      </div>
      <Tiles
        items={[
          { label: "Products", value: products.length },
          { label: "Low stock", value: low, alert: low > 0 },
          { label: "Open orders", value: stats.open },
          { label: "Order value", value: formatMoney(stats.valueCents) },
        ]}
      />
      <Panel title="Profile">
        <ProfileList rows={profileRows(supplier, profile)} />
      </Panel>

      <SectionHead>Shop products</SectionHead>
      {products.length === 0 ? (
        <EmptyState>No products yet.</EmptyState>
      ) : (
        <RecordList>
          {products.map((product) => (
            <RecordCard
              key={product.id}
              lead={<ProductArt kind={product.art} size={36} />}
              title={product.name}
              sub={<span className="font-mono text-[.86em]">{product.sku}</span>}
              pill={<Pill tone={HEALTH_PILL[product.health].tone}>{HEALTH_PILL[product.health].label}</Pill>}
              metrics={[
                { label: "Price", value: formatMoney(product.price) },
                { label: "On hand", value: product.onHand },
                { label: "Available", value: product.status === "unconfirmed" ? "To confirm" : product.available },
              ]}
            />
          ))}
        </RecordList>
      )}

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
