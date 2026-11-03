import type { Metadata } from "next";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { AddProductForm } from "@/features/supplier/AddProductForm";
import { newIdempotencyKey } from "@/features/supplier/keys";
import { PageHead } from "@/features/supplier/PageHead";
import { ProductRecord } from "@/features/supplier/ProductRecord";
import { filterInventory, inventoryHref, needsReorder } from "@/features/supplier/stock";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { controlClass } from "@/ui/Field";
import { LinkButton } from "@/ui/LinkButton";
import { RecordList } from "@/ui/RecordCard";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Inventory · Tradelink" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function SupplierInventoryPage({ searchParams }: Props) {
  const session = await requireRole("supplier");
  const params = await searchParams;
  const q = first(params.q).slice(0, 80);
  const low = first(params.low) === "1";
  const adding = first(params.add) === "1";

  const products = await getCatalogue({ supplierOrgId: session.orgId });
  const reorder = products.filter(needsReorder).length;
  const list = filterInventory(products, q, low);

  return (
    <>
      <PageHead title="Inventory">Stock held by {session.orgName}. Available means on hand minus reserved.</PageHead>
      <Tiles
        items={[
          { label: "Products", value: products.length },
          { label: "Units on hand", value: products.reduce((total, item) => total + item.onHand, 0) },
          { label: "Units reserved", value: products.reduce((total, item) => total + item.reserved, 0) },
          { label: "Need reordering", value: reorder, alert: reorder > 0 },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <form action="/supplier/inventory" role="search" className="flex min-w-[220px] flex-1 gap-1.5">
          {low ? <input type="hidden" name="low" value="1" /> : null}
          <input
            id="inventory-search"
            className={controlClass}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or SKU"
            aria-label="Search inventory"
            maxLength={80}
          />
          <Button type="submit">Search</Button>
        </form>
        <Chip href={inventoryHref({ q, low: !low })} selected={low}>
          Low stock only
        </Chip>
        {adding ? null : (
          <LinkButton href={inventoryHref({ q, low, add: true })} variant="primary" scroll={false}>
            Add product
          </LinkButton>
        )}
      </div>
      {adding ? <AddProductForm idemKey={newIdempotencyKey()} closeHref={inventoryHref({ q, low })} /> : null}
      {list.length === 0 ? (
        <EmptyState>No products match this view.</EmptyState>
      ) : (
        <RecordList>
          {list.map((item) => (
            <ProductRecord key={item.id} item={item} idemKey={newIdempotencyKey()} />
          ))}
        </RecordList>
      )}
    </>
  );
}
