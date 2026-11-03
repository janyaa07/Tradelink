"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { CATEGORIES, CATEGORY_LABELS, type CatalogueItem, type Category } from "@/domain/catalogue";
import { Chip, ChipRow } from "@/ui/Chip";
import { controlClass } from "@/ui/Field";
import { LinkButton } from "@/ui/LinkButton";
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
};

type Change = { productId: string; qty: number };

/** Search, category chips, the product grid and View cart. */
export function ProductsBrowser({ catalogue, inCart, cartLines }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [, start] = useTransition();
  const [quantities, setQuantity] = useOptimistic(inCart, (state, change: Change) => ({ ...state, [change.productId]: change.qty }));

  const items = catalogue.filter((item) => matchesSearch(item, query) && (category === "all" || item.category === category));
  const count = shownLineCount(cartLines, inCart, quantities);

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
    <>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search products or suppliers"
          aria-label="Search products"
          className={controlClass}
        />
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Products">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <ProductTile item={item} qty={quantities[item.id] ?? 0} onChange={change} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-surface px-3.5 py-[26px] text-center text-muted shadow-card" role="status">
          No products match your search.
        </p>
      )}

      {count > 0 ? (
        <div className="pointer-events-none sticky bottom-3 z-10 flex justify-end pt-1">
          <LinkButton href="/buyer/cart" variant="primary" className="pointer-events-auto rounded-full px-5 shadow-card">
            View cart ({count})
          </LinkButton>
        </div>
      ) : null}
    </>
  );
}
