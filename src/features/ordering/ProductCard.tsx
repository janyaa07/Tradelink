import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";

function Availability({ item }: { item: CatalogueItem }) {
  if (item.status === "unconfirmed") return <Pill tone="info">Stock to confirm</Pill>;
  if (item.available <= 0) return <Pill tone="bad">Out of stock</Pill>;
  if (item.health === "low") return <Pill tone="warn">Only {item.available} left</Pill>;
  return <Pill tone="good">{item.available} available</Pill>;
}

type Props = {
  item: CatalogueItem;
  /** Quantity of this product already in the order. */
  inOrder: number;
  onAdd: (item: CatalogueItem) => void;
  busy?: boolean;
};

/** The prototype's product card: art, price, name, unit and supplier, availability, and "+" (BUY-12, BUY-42). */
export function ProductCard({ item, inOrder, onAdd, busy = false }: Props) {
  const out = item.status === "active" && item.available <= 0;
  return (
    <article className="relative flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-2.5 shadow-card">
      <div className="mb-1">
        <ProductArt kind={item.art} size="fill" />
      </div>
      {inOrder > 0 ? (
        <span className="absolute top-4 left-4">
          <Pill tone="good">{inOrder} in order</Pill>
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => onAdd(item)}
        disabled={out || busy}
        aria-label={`Add ${item.name}`}
        className="absolute top-[72px] right-4 grid size-9 place-items-center rounded-full border-0 bg-accent text-[1.3rem] font-semibold leading-none text-on-accent shadow-card disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none"
      >
        <span aria-hidden="true">+</span>
      </button>
      <span className="text-[.95rem] font-extrabold tabular-nums">{formatMoney(item.price)}</span>
      <b className="text-[.88rem] leading-[1.25]">{item.name}</b>
      <span className="text-[.75rem] text-muted">
        per {item.unit} · {item.supplierName}
      </span>
      <span>
        <Availability item={item} />
      </span>
    </article>
  );
}
