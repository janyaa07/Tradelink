import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { OrgStatusPill } from "@/features/admin/components/Layout";
import { NameCell, PhoneList, PhoneRow, SelectRowLink } from "@/features/admin/components/Rows";
import { SupplierStatusControl } from "@/features/admin/components/SupplierStatusControl";
import { deliveryDaysLabel, ORG_STATUS, timeLabel } from "@/features/admin/labels";
import { EMPTY_STATS, statsByOrg } from "@/features/admin/orderStats";
import { listHref, ORG_STATUS_FILTERS, param, parseOrgStatusFilter, type OrgStatusFilter, type SearchParams } from "@/features/admin/params";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisations, getSupplierProfile, type Organisation, type SupplierProfile } from "@/features/admin/queries/organisations";
import { getProductCountsBySupplier, type ProductCounts } from "@/features/admin/queries/stock";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { cx } from "@/ui/cx";
import { Cell, DataTable, Row } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, PageHeader } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Suppliers" };

const COLUMNS = [
  { label: "Supplier" },
  { label: "Products", align: "right" as const, className: "w-24" },
  { label: "Low stock", align: "right" as const, className: "w-24" },
  { label: "Open orders", align: "right" as const, className: "w-28" },
  { label: "Status", className: "w-36" },
];

const FILTER_LABELS: Record<OrgStatusFilter, string> = {
  all: "All",
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
  declined: ORG_STATUS.declined.label,
};

const NO_PRODUCTS: ProductCounts = { products: 0, low: 0 };

function joinedLine(supplier: Organisation): string {
  if (supplier.joinedAt) return `Joined ${formatDateTime(supplier.joinedAt)}`;
  return supplier.invitedBy ? `Invited by ${supplier.invitedBy}` : "Not joined yet";
}

/** The selected supplier beside the table on a laptop: contact, terms and the main actions. */
function SupplierPanel({ supplier, profile }: { supplier: Organisation; profile: SupplierProfile | null }) {
  const rows: [string, string][] = [
    ["Contact", supplier.contactName ?? "Not given"],
    ["Phone", supplier.phone ?? "Not given"],
    ["Email", supplier.email ?? "Not given"],
  ];
  if (profile) {
    rows.push(
      ["Delivers", deliveryDaysLabel(profile.deliveryDays)],
      ["Order cut-off", timeLabel(profile.cutoffTime)],
      ["Minimum order", formatMoney(Number(profile.minimumOrder).toFixed(2))],
    );
  }
  if (supplier.invitedBy && supplier.joinedAt) rows.push(["Invited by", supplier.invitedBy]);
  const canChangeStatus = supplier.status === "active" || supplier.status === "suspended";

  return (
    <aside aria-label={supplier.name} className="hidden flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card rail:flex">
      <div className="flex items-center gap-2.5">
        <BusinessLogo name={supplier.name} size={36} />
        <div className="min-w-0 flex-1">
          <h2 className="break-words">{supplier.name}</h2>
          <p className="text-[.78rem] text-muted">{joinedLine(supplier)}</p>
        </div>
        <OrgStatusPill status={supplier.status} />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[.84rem]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right break-words [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/admin/suppliers/${supplier.id}`} className="flex-1">
          Open supplier
        </LinkButton>
        {canChangeStatus ? (
          <SupplierStatusControl
            key={supplier.id}
            orgId={supplier.id}
            name={supplier.name}
            status={supplier.status === "active" ? "active" : "suspended"}
            idempotencyKey={crypto.randomUUID()}
          />
        ) : null}
      </div>
    </aside>
  );
}

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const params = await searchParams;
  const filter = parseOrgStatusFilter(param(params, "status"));
  const [suppliers, productCounts, orderRows] = await Promise.all([getOrganisations("supplier"), getProductCountsBySupplier(), getOrderStatRows()]);
  const orders = statsByOrg(orderRows);
  const shown = filter === "all" ? suppliers : suppliers.filter((supplier) => supplier.status === filter);
  const selectedId = param(params, "selected");
  const selected = shown.find((supplier) => supplier.id === selectedId) ?? shown[0] ?? null;
  const profile = selected ? await getSupplierProfile(selected.id) : null;
  const tabs = ORG_STATUS_FILTERS.filter((tab) => tab !== "declined" || suppliers.some((supplier) => supplier.status === "declined"));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Suppliers"
        description="Every supplier on Tradelink, their stock and their orders."
        actions={
          <LinkButton href="/admin/suppliers/low-stock" size="small">
            View low stock
          </LinkButton>
        }
      />
      <FilterTabs
        label="Filter suppliers"
        tabs={tabs.map((tab) => ({
          href: listHref("/admin/suppliers", { status: tab }),
          label: FILTER_LABELS[tab],
          count: tab === "all" ? suppliers.length : suppliers.filter((supplier) => supplier.status === tab).length,
          current: tab === filter,
        }))}
      />

      {shown.length === 0 ? (
        <EmptyState>{filter === "all" ? "No suppliers yet." : "No suppliers here."}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 min-[1000px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <DataTable
            label="Suppliers"
            columns={COLUMNS}
            phone={
              <PhoneList label="Suppliers">
                {shown.map((supplier) => {
                  const products = productCounts.get(supplier.id) ?? NO_PRODUCTS;
                  const open = (orders.get(supplier.id) ?? EMPTY_STATS).open;
                  return (
                    <PhoneRow
                      key={supplier.id}
                      href={`/admin/suppliers/${supplier.id}`}
                      lead={<BusinessLogo name={supplier.name} size={36} />}
                      title={supplier.name}
                      sub={`${products.products} products · ${products.low} low stock · ${open} open orders`}
                      end={<OrgStatusPill status={supplier.status} />}
                    />
                  );
                })}
              </PhoneList>
            }
          >
            {shown.map((supplier) => {
              const products = productCounts.get(supplier.id) ?? NO_PRODUCTS;
              const isSelected = supplier.id === selected?.id;
              return (
                <Row key={supplier.id} selected={isSelected}>
                  <Cell>
                    <NameCell
                      logoName={supplier.name}
                      name={
                        <SelectRowLink href={listHref("/admin/suppliers", { status: filter, selected: supplier.id })} selected={isSelected}>
                          {supplier.name}
                        </SelectRowLink>
                      }
                      sub={supplier.contactName ?? "No contact person"}
                    />
                  </Cell>
                  <Cell num align="right">
                    {products.products}
                  </Cell>
                  <Cell num align="right" className={cx(products.low > 0 && "font-semibold text-warn")}>
                    {products.low}
                  </Cell>
                  <Cell num align="right">
                    {(orders.get(supplier.id) ?? EMPTY_STATS).open}
                  </Cell>
                  <Cell>
                    <OrgStatusPill status={supplier.status} />
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
          {selected ? <SupplierPanel supplier={selected} profile={profile} /> : null}
        </div>
      )}
    </div>
  );
}
