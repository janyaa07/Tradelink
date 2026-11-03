"use client";

import Link from "next/link";
import type { CatalogueItem } from "@/domain/catalogue";
import { textLinkClass } from "@/ui/LinkButton";
import { ProductCard } from "./ProductCard";

type Props = {
  items: CatalogueItem[];
  inOrder: Map<string, number>;
  onAdd: (item: CatalogueItem) => void;
  onAddAll: () => void;
};

/** "Your usuals": a horizontal scroller of product cards with "Add all" (BUY-12). */
export function UsualsRow({ items, inOrder, onAdd, onAddAll }: Props) {
  return (
    <section aria-labelledby="usuals-title" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="usuals-title">Your usuals</h2>
        {items.length > 0 ? (
          <button type="button" className={`${textLinkClass} border-0 bg-transparent p-0`} onClick={onAddAll}>
            Add all
          </button>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul className="flex snap-x gap-2.5 overflow-x-auto px-0.5 pt-0.5 pb-2">
          {items.map((item) => (
            <li key={item.id} className="flex-[0_0_148px] snap-start">
              <ProductCard item={item} inOrder={inOrder.get(item.id) ?? 0} onAdd={onAdd} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">
          You have no usual items yet.{" "}
          <Link href="/buyer/settings" className={textLinkClass}>
            Add them in Settings
          </Link>
        </p>
      )}
    </section>
  );
}
