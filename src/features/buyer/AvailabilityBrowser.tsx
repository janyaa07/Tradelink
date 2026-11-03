"use client";

import { useState, useTransition } from "react";
import { CATEGORIES, CATEGORY_LABELS, type CatalogueItem, type Category } from "@/domain/catalogue";
import { addProductToDraftAction } from "@/features/ordering/draft-actions";
import { ProductCard } from "@/features/ordering/ProductCard";
import { Chip, ChipRow } from "@/ui/Chip";
import { controlClass } from "@/ui/Field";
import { useToast } from "@/ui/Toast";

type Props = {
  catalogue: CatalogueItem[];
  /** Quantity of each product already in the draft. */
  inOrder: Record<string, number>;
};

/** Search, category chips and the product grid (BUY-42). */
export function AvailabilityBrowser({ catalogue, inOrder }: Props) {
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [busy, start] = useTransition();
  const search = query.trim().toLowerCase();
  const items = catalogue.filter(
    (item) => (!search || item.name.toLowerCase().includes(search)) && (category === "all" || item.category === category),
  );

  const add = (item: CatalogueItem) =>
    start(async () => {
      const result = await addProductToDraftAction(item.id);
      show(result.ok ? `${item.name} added.` : result.error);
    });

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search products"
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
      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2.5 @min-[620px]:grid-cols-3 @min-[980px]:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <ProductCard item={item} inOrder={inOrder[item.id] ?? 0} onAdd={add} busy={busy} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-surface px-3.5 py-[26px] text-center text-muted shadow-card" role="status">
          No products match your search.
        </p>
      )}
    </>
  );
}
