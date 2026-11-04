"use client";

import { useState } from "react";
import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { Button } from "@/ui/Button";
import { ConfirmForm } from "./StockForms";

/** A product a buyer added, with the idempotency key its confirm form sends. */
export type AddedProduct = { item: CatalogueItem; idemKey: string };

function AddedProductRow({ item, idemKey }: AddedProduct) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <span className="block font-semibold break-words">{item.name}</span>
          <span className="num block text-[.75rem] text-muted">
            <span className="font-mono">{item.sku}</span> · estimated price {formatMoney(item.price)}
          </span>
        </div>
        {open ? null : (
          <Button size="small" variant="primary" onClick={() => setOpen(true)}>
            Confirm stock<span className="sr-only"> for {item.name}</span>
          </Button>
        )}
      </div>
      {open ? <ConfirmForm item={item} idemKey={idemKey} onClose={() => setOpen(false)} /> : null}
    </li>
  );
}

/** Products a buyer added to this order: the supplier confirms the real price and stock here, as on Inventory (SUP-13). */
export function ConfirmAddedProducts({ products }: { products: AddedProduct[] }) {
  return (
    <ul className="divide-y divide-line border-t border-line">
      {products.map((product) => (
        <AddedProductRow key={product.item.id} {...product} />
      ))}
    </ul>
  );
}
