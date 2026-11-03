import { useId } from "react";
import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { Button } from "@/ui/Button";
import { Pill } from "@/ui/Pill";
import { ProductImage } from "@/ui/ProductImage";
import { availabilityOf } from "./availability";

type Props = {
  item: CatalogueItem;
  /** This product's quantity in the cart, 0 when it is not in the cart. */
  qty: number;
  onChange: (item: CatalogueItem, qty: number) => void;
};

const stepClass =
  "grid size-10 flex-none place-items-center rounded-md border-0 bg-transparent text-[1.1rem] font-semibold leading-none text-accent hover:bg-surface disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent rail:size-8";

/** A compact product card: picture, name, supplier and unit, price, availability, and Add to cart or a stepper. */
export function ProductTile({ item, qty, onChange }: Props) {
  const reasonId = useId();
  const availability = availabilityOf(item);
  const atLimit = qty >= availability.limit;

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-line bg-surface p-3 shadow-card">
      <ProductImage art={item.art} category={item.category} name={item.name} size="fill" decorative className="rounded-md" />
      <h2 className="mt-2.5 text-[.875rem] leading-snug font-semibold">{item.name}</h2>
      <p className="mt-0.5 text-[.75rem] text-muted">
        {item.supplierName} · per {item.unit}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2.5">
        <b className="num text-[.9rem]">{formatMoney(item.price)}</b>
        <Pill tone={availability.tone}>{availability.label}</Pill>
      </div>
      {qty > 0 ? (
        <div className="flex items-center justify-between rounded-lg bg-accent-soft px-0.5" role="group" aria-label={`${item.name} in cart`}>
          <button type="button" className={stepClass} onClick={() => onChange(item, qty - 1)} aria-label={`Remove one ${item.name}`}>
            <span aria-hidden="true">−</span>
          </button>
          <span className="text-[.84rem] font-bold tabular-nums text-accent" aria-live="polite">
            {qty}
            <span className="sr-only"> in cart</span>
          </span>
          <button
            type="button"
            className={stepClass}
            onClick={() => onChange(item, qty + 1)}
            disabled={atLimit}
            aria-label={`Add one more ${item.name}`}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      ) : (
        <Button
          onClick={() => onChange(item, 1)}
          disabled={!availability.orderable}
          aria-describedby={availability.reason ? reasonId : undefined}
          className="min-h-10 w-full text-[.84rem] hover:border-accent hover:text-accent disabled:border-line disabled:bg-sunken disabled:text-muted disabled:opacity-100 rail:min-h-0"
        >
          Add to cart
        </Button>
      )}
      {availability.reason && qty === 0 ? (
        <p id={reasonId} className="pt-1.5 text-[.72rem] text-muted">
          {availability.reason}
        </p>
      ) : null}
    </article>
  );
}
