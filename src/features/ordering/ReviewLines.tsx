"use client";

import { plural, type CatalogueItem } from "@/domain/catalogue";
import { Button } from "@/ui/Button";
import { controlClass } from "@/ui/Field";
import type { DraftLine } from "./draft";
import { LineCard, type LineHandlers } from "./LineCard";
import type { LineView } from "./line-view";
import type { SupplierOption } from "./review-types";

type Props = {
  lines: DraftLine[];
  views: Map<string, LineView>;
  byId: Map<string, CatalogueItem>;
  catalogue: CatalogueItem[];
  suppliers: SupplierOption[];
  addingId: string | null;
  handlers: LineHandlers;
  onAddProduct: (productId: string) => void;
  onEdit: () => void;
};

function availabilityText(item: CatalogueItem): string {
  return item.status === "unconfirmed" ? "stock to confirm" : `${Math.max(0, item.available)} available`;
}

/** "Review {n} lines": one card per line, then "Add another product" (BUY-13, BUY-14). */
export function ReviewLines({ lines, views, byId, catalogue, suppliers, addingId, handlers, onAddProduct, onEdit }: Props) {
  return (
    <section aria-labelledby="review-title" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="review-title" className="flex-1">
          Review {plural(lines.length, "line")}
        </h2>
        <Button onClick={onEdit}>Add more items</Button>
      </div>
      {lines.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-3.5 py-[26px] text-center text-muted shadow-card">
          Add a product to start this order.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => {
            const view = views.get(line.id);
            return view ? (
              <LineCard
                key={line.id}
                line={line}
                view={view}
                byId={byId}
                catalogue={catalogue}
                suppliers={suppliers}
                adding={addingId === line.id}
                handlers={handlers}
              />
            ) : null;
          })}
        </ul>
      )}
      <select
        value=""
        aria-label="Add a product"
        onChange={(event) => {
          if (event.currentTarget.value) onAddProduct(event.currentTarget.value);
        }}
        className={controlClass}
      >
        <option value="">Add another product</option>
        {catalogue.map((item) => (
          <option key={item.id} value={item.id}>{`${item.name} · ${availabilityText(item)}`}</option>
        ))}
      </select>
    </section>
  );
}
