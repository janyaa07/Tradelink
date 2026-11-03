import type { Metadata } from "next";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { AddProductForm } from "@/features/supplier/AddProductForm";
import { InventoryTable } from "@/features/supplier/InventoryTable";
import { newIdempotencyKey } from "@/features/supplier/keys";
import { ProductRecord } from "@/features/supplier/ProductRecord";
import {
  filterInventory,
  INVENTORY_FILTER_LABELS,
  INVENTORY_FILTERS,
  inventoryHref,
  needsReorder,
  parseInventoryFilter,
  type InventoryFilter,
} from "@/features/supplier/stock";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, PageHeader, SearchBox } from "@/ui/PageHeader";
import { RecordList } from "@/ui/RecordCard";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Inventory · Tradelink" };

const EMPTY: Record<InventoryFilter, string> = {
  all: "No products yet. Add one and buyers can order it straight away.",
  low: "Nothing is running low.",
  out: "Nothing is out of stock.",
  confirm: "Nothing to confirm. Products a buyer adds to an order show here until you confirm their stock.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => ((Array.isArray(value) ? value[0] : value) ?? "").trim();

export default async function SupplierInventoryPage({ searchParams }: Props) {
  const session = await requireRole("supplier");
  const params = await searchParams;
  const q = first(params.q).slice(0, 60);
  const filter = parseInventoryFilter(first(params.filter));
  const adding = first(params.add) === "1";

  const products = await getCatalogue({ supplierOrgId: session.orgId });
  const reorder = products.filter(needsReorder).length;
  const list = filterInventory(products, q, filter);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventory"
        description={`Stock held by ${session.orgName}. Available is on hand minus what is reserved for orders.`}
        actions={
          <>
            <LinkButton href="/supplier/stock-history">Stock history</LinkButton>
            {adding ? null : (
              <LinkButton href={inventoryHref({ q, filter, add: true })} variant="primary" scroll={false}>
                Add product
              </LinkButton>
            )}
          </>
        }
      />
      <Tiles
        items={[
          { label: "Products", value: products.length },
          { label: "Units on hand", value: products.reduce((total, item) => total + item.onHand, 0) },
          { label: "Units reserved", value: products.reduce((total, item) => total + item.reserved, 0) },
          { label: "Need reordering", value: reorder, alert: reorder > 0 },
        ]}
      />
      {adding ? <AddProductForm idemKey={newIdempotencyKey()} closeHref={inventoryHref({ q, filter })} /> : null}
      <div className="flex flex-col gap-3 rail:flex-row rail:items-center rail:justify-between">
        <FilterTabs
          label="Show products"
          tabs={INVENTORY_FILTERS.map((each) => ({
            href: inventoryHref({ q, filter: each }),
            label: INVENTORY_FILTER_LABELS[each],
            count: filterInventory(products, q, each).length,
            current: each === filter,
          }))}
        />
        <SearchBox
          action="/supplier/inventory"
          label="Search inventory"
          placeholder="Search name or SKU"
          defaultValue={q}
          keep={{ filter: filter === "all" ? undefined : filter }}
        />
      </div>
      {q ? (
        <p className="flex flex-wrap items-center gap-x-3 text-[.84rem] text-muted">
          <span>
            Results for <b className="text-ink">{q}</b>
          </span>
          <LinkButton variant="text" href={inventoryHref({ filter })}>
            Clear search
          </LinkButton>
        </p>
      ) : null}
      {list.length === 0 ? (
        <EmptyState>{q ? `Nothing matches "${q}" here.` : EMPTY[filter]}</EmptyState>
      ) : (
        <InventoryTable
          rows={list.map((item) => ({ item, idemKey: newIdempotencyKey() }))}
          phone={
            <RecordList>
              {list.map((item) => (
                <ProductRecord key={item.id} item={item} idemKey={newIdempotencyKey()} />
              ))}
            </RecordList>
          }
        />
      )}
    </div>
  );
}
