import type { CatalogueItem } from "@/domain/catalogue";
import { stockBarPercent } from "./stock";

const TONES = { healthy: "bg-accent", low: "bg-warn", out: "bg-bad", unconfirmed: "bg-accent" } as const;

/** Available stock against twice the reorder level. Decorative: the figures and the Pill carry the meaning. */
export function StockBar({ item }: { item: Pick<CatalogueItem, "status" | "available" | "reorderLevel" | "health"> }) {
  const percent = stockBarPercent(item);
  if (percent === null) return null;
  return (
    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-sunken">
      <div className={`h-full rounded-full ${TONES[item.health]}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
