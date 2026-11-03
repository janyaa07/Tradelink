"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { CATEGORIES, CATEGORY_LABELS, healthOf, plural, type CatalogueItem, type Category } from "@/domain/catalogue";
import { formatMoney, lineTotal } from "@/domain/money";
import { Chip, ChipRow } from "@/ui/Chip";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { LinkButton } from "@/ui/LinkButton";
import { PageHeader } from "@/ui/PageHeader";
import { useToast } from "@/ui/Toast";
import { setCartQuantityAction } from "./actions";
import { matchesSearch } from "./availability";
import { cartMessage, clampQuantity, shownLineCount } from "./cart";
import { ProductTile } from "./ProductTile";

type Props = {
  catalogue: CatalogueItem[];
  /** Each product's quantity in the cart, read on the server. */
  inCart: Record<string, number>;
  /** The number of lines in the cart, read on the server. */
  cartLines: number;
  /** Search words to start with, from a link such as a Tradelink AI product card. */
  initialQuery?: string;
};

type Change = { productId: string; qty: number };

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-0.5">
      <p className="mb-1.5 text-[.72rem] font-semibold text-muted">{title}</p>
      {children}
    </div>
  );
}

function FilterOption({ selected, count, onClick, children }: { selected: boolean; count: number; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex items-center justify-between gap-2 rounded-md border-0 px-2 py-1.5 text-left text-[.84rem] transition-colors duration-150",
        selected ? "bg-accent-soft font-semibold text-accent" : "bg-transparent text-ink hover:bg-sunken",
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="num flex-none text-[.75rem] font-normal text-muted">{count}</span>
    </button>
  );
}

/** The catalogue: search, filters (a side column on a laptop, category chips on a phone), the product grid and the cart. */
export function ProductsBrowser({ catalogue, inCart, cartLines, initialQuery = "" }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category | "all">("all");
  const [supplier, setSupplier] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [, start] = useTransition();
  const [quantities, setQuantity] = useOptimistic(inCart, (state, change: Change) => ({ ...state, [change.productId]: change.qty }));

  const suppliers = [...new Map(catalogue.map((item) => [item.supplierOrgId, item.supplierName]))].sort((a, b) => a[1].localeCompare(b[1]));
  const items = catalogue.filter(
    (item) =>
      matchesSearch(item, query) &&
      (category === "all" || item.category === category) &&
      (supplier === null || item.supplierOrgId === supplier) &&
      (!inStockOnly || healthOf(item) !== "out"),
  );
  const count = shownLineCount(cartLines, inCart, quantities);
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const cartCents = Object.entries(quantities).reduce((sum, [productId, qty]) => {
    const item = byId.get(productId);
    return item && qty > 0 ? sum + lineTotal(item.price, qty) : sum;
  }, 0);

  const change = (item: CatalogueItem, qty: number) => {
    const before = quantities[item.id] ?? 0;
    const next = clampQuantity(qty);
    start(async () => {
      setQuantity({ productId: item.id, qty: next });
      try {
        const result = await setCartQuantityAction(item.id, next);
        show(result.ok ? cartMessage(item.name, before, result.data.qty) : result.error);
      } catch {
        show("Something went wrong. Try again.");
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Products"
        description={`${plural(catalogue.length, "product")} from your ${plural(suppliers.length, "supplier")}. Prices are per unit, before GST.`}
        actions={
          <LinkButton href="/buyer/cart" className="hidden rail:inline-flex">
            <Icon name="cart" size={16} />
            View cart
            {count > 0 ? (
              <span className="num font-medium text-muted">
                · {plural(count, "line")} · {formatMoney(cartCents)}
              </span>
            ) : null}
          </LinkButton>
        }
      />

      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search products or suppliers"
          aria-label="Search products"
          className="min-h-10 w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 text-[.875rem] text-ink placeholder:text-muted"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 rail:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden flex-col gap-5 rail:flex">
          <FilterGroup title="Category">
            <FilterOption selected={category === "all"} count={catalogue.length} onClick={() => setCategory("all")}>
              All
            </FilterOption>
            {CATEGORIES.map((value) => (
              <FilterOption
                key={value}
                selected={category === value}
                count={catalogue.filter((item) => item.category === value).length}
                onClick={() => setCategory(value)}
              >
                {CATEGORY_LABELS[value]}
              </FilterOption>
            ))}
          </FilterGroup>
          {suppliers.length > 1 ? (
            <FilterGroup title="Supplier">
              {suppliers.map(([id, name]) => (
                <FilterOption
                  key={id}
                  selected={supplier === id}
                  count={catalogue.filter((item) => item.supplierOrgId === id).length}
                  onClick={() => setSupplier(supplier === id ? null : id)}
                >
                  {name}
                </FilterOption>
              ))}
            </FilterGroup>
          ) : null}
          <label className="flex items-center gap-2 px-2 text-[.84rem]">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.currentTarget.checked)}
              className="size-4 accent-accent"
            />
            In stock only
          </label>
        </aside>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="rail:hidden">
            <ChipRow label="Categories">
              <Chip selected={category === "all"} onClick={() => setCategory("all")}>
                All
              </Chip>
              {CATEGORIES.map((value) => (
                <Chip key={value} selected={category === value} onClick={() => setCategory(value)}>
                  {CATEGORY_LABELS[value]}
                </Chip>
              ))}
            </ChipRow>
          </div>

          {items.length > 0 ? (
            <div className="@container">
              <ul className="grid grid-cols-2 gap-3 @min-[540px]:grid-cols-3 @min-[760px]:grid-cols-4" aria-label="Products">
                {items.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <ProductTile item={item} qty={quantities[item.id] ?? 0} onChange={change} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-surface px-3.5 py-[26px] text-center text-muted shadow-card" role="status">
              No products match your search and filters.
            </p>
          )}
        </div>
      </div>

      {count > 0 ? (
        <div className="pointer-events-none sticky bottom-3 z-10 flex justify-end pt-1 rail:hidden">
          <LinkButton href="/buyer/cart" variant="primary" className="pointer-events-auto rounded-full px-5 shadow-card">
            View cart ({count})
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}
