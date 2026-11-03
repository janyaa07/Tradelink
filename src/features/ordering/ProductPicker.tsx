"use client";

import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";

type Props = {
  value: string | null;
  /** Candidate product IDs from the reader, best first. */
  options: string[];
  byId: Map<string, CatalogueItem>;
  catalogue: CatalogueItem[];
  label: string;
  onChange: (productId: string | null) => void;
};

function Option({ item }: { item: CatalogueItem }) {
  return (
    <option value={item.id}>{`${item.name} · ${formatMoney(item.price)}`}</option>
  );
}

/** "Best matches" first, then every product the buyer can order, each with its price (BUY-14). */
export function ProductPicker({ value, options, byId, catalogue, label, onChange }: Props) {
  const best = options.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const bestIds = new Set(best.map((item) => item.id));
  const rest = catalogue.filter((item) => !bestIds.has(item.id));
  return (
    <select
      value={value && byId.has(value) ? value : ""}
      onChange={(event) => onChange(event.currentTarget.value || null)}
      aria-label={label}
      className="w-full min-w-0 min-h-10 rounded-md border border-control-line bg-sunken px-2 py-[7px] text-[.92rem] text-ink"
    >
      <option value="">Choose a product</option>
      {best.length > 0 ? (
        <optgroup label="Best matches">
          {best.map((item) => (
            <Option key={item.id} item={item} />
          ))}
        </optgroup>
      ) : null}
      <optgroup label={best.length > 0 ? "All products" : "Catalogue"}>
        {rest.map((item) => (
          <Option key={item.id} item={item} />
        ))}
      </optgroup>
    </select>
  );
}
