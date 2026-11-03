import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { BackLink, PageHead } from "@/features/admin/components/Layout";
import { getLowStock } from "@/features/admin/queries/stock";
import { EmptyState } from "@/ui/EmptyState";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Low stock" };

const LIMIT = 500;

export default async function LowStockPage() {
  await requireRole("admin");
  const { items, total } = await getLowStock(LIMIT);

  return (
    <>
      <BackLink href="/admin/suppliers">Back to suppliers</BackLink>
      <PageHead
        title="Low stock"
        sub={total > items.length ? `The ${items.length} emptiest of ${total} products at or below their reorder level.` : "Products at or below their reorder level, emptiest first."}
      />
      {items.length === 0 ? (
        <EmptyState>All products are above their reorder level.</EmptyState>
      ) : (
        <RecordList>
          {items.map((product) => (
            <RecordCard
              key={product.id}
              lead={<ProductArt kind={product.art} size={36} />}
              title={product.name}
              sub={
                <>
                  <span className="font-mono text-[.86em]">{product.sku}</span> · {product.supplierName}
                </>
              }
              titleHref={`/admin/suppliers/${product.supplierOrgId}`}
              pill={product.health === "out" ? <Pill tone="bad">Out of stock</Pill> : <Pill tone="warn">Low stock</Pill>}
              metrics={[
                { label: "Available", value: product.available },
                { label: "Reorder level", value: product.reorderLevel },
              ]}
            />
          ))}
        </RecordList>
      )}
    </>
  );
}
