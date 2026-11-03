import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { OrgStatusPill, PageHead } from "@/features/admin/components/Layout";
import { EMPTY_STATS, statsByOrg } from "@/features/admin/orderStats";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { getProductCountsBySupplier } from "@/features/admin/queries/stock";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requireRole("admin");
  const [suppliers, productCounts, orderRows] = await Promise.all([
    getOrganisations("supplier"),
    getProductCountsBySupplier(),
    getOrderStatRows(),
  ]);
  const orders = statsByOrg(orderRows);

  return (
    <>
      <PageHead
        title="Suppliers"
        sub="Open a supplier to see its profile, products and orders."
        action={
          <LinkButton href="/admin/suppliers/low-stock" variant="text">
            Low stock
          </LinkButton>
        }
      />
      {suppliers.length === 0 ? (
        <EmptyState>No suppliers yet.</EmptyState>
      ) : (
        <RecordList>
          {suppliers.map((supplier) => {
            const products = productCounts.get(supplier.id) ?? { products: 0, low: 0 };
            return (
              <RecordCard
                key={supplier.id}
                lead={<BusinessLogo name={supplier.name} size={36} />}
                title={supplier.name}
                titleHref={`/admin/suppliers/${supplier.id}`}
                sub={supplier.contactName ?? "No contact person"}
                pill={<OrgStatusPill status={supplier.status} />}
                metrics={[
                  { label: "Products", value: products.products },
                  { label: "Low stock", value: products.low },
                  { label: "Open orders", value: (orders.get(supplier.id) ?? EMPTY_STATS).open },
                ]}
              />
            );
          })}
        </RecordList>
      )}
    </>
  );
}
