import type { CatalogueItem, Health } from "@/domain/catalogue";
import type { PillTone } from "@/ui/Pill";

export const HEALTH_PILL: Record<Health, { label: string; tone: PillTone }> = {
  healthy: { label: "Healthy", tone: "good" },
  low: { label: "Low stock", tone: "warn" },
  out: { label: "Out of stock", tone: "bad" },
  unconfirmed: { label: "Stock unconfirmed", tone: "info" },
};

/** Low or out of stock. Unconfirmed products are counted separately. */
export function needsReorder(item: Pick<CatalogueItem, "health">): boolean {
  return item.health === "low" || item.health === "out";
}

/**
 * Stock bar width in percent, as in the prototype: available against twice the reorder level,
 * never below 3% so an empty bar still shows. Null for unconfirmed products, which have no bar.
 */
export function stockBarPercent(item: Pick<CatalogueItem, "status" | "available" | "reorderLevel">): number | null {
  if (item.status === "unconfirmed") return null;
  const percent = (Math.max(0, item.available) / Math.max(1, item.reorderLevel * 2)) * 100;
  return Math.round(Math.max(3, Math.min(100, percent)));
}

/** Filters inventory by name or SKU and, optionally, to products that need reordering (SUP-10). */
export function filterInventory<T extends Pick<CatalogueItem, "name" | "sku" | "health">>(
  items: T[],
  query: string,
  lowOnly: boolean,
): T[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (item) => (!q || `${item.name} ${item.sku}`.toLowerCase().includes(q)) && (!lowOnly || needsReorder(item)),
  );
}

export type MovementType = "received" | "reserved" | "released" | "delivered" | "adjusted";
export type AdjustReason = "damaged" | "expired" | "count_correction";

export const MOVEMENT_PILL: Record<MovementType, { label: string; tone: PillTone }> = {
  received: { label: "Received", tone: "good" },
  reserved: { label: "Reserved", tone: "info" },
  released: { label: "Released", tone: "plain" },
  delivered: { label: "Delivered", tone: "warn" },
  adjusted: { label: "Adjusted", tone: "plain" },
};

export const ADJUST_REASONS: { value: AdjustReason; label: string }[] = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "count_correction", label: "Count correction" },
];

type Movement = {
  type: MovementType;
  onHandChange: number;
  reservedChange: number;
  reason: string | null;
  source: string;
};

/** The units a stock change moved: reservations count reserved units, the rest count units on hand. */
export function movementUnits(movement: Pick<Movement, "type" | "onHandChange" | "reservedChange">): number {
  return movement.type === "reserved" || movement.type === "released" ? movement.reservedChange : movement.onHandChange;
}

export function signedUnits(units: number): string {
  return units > 0 ? `+${units}` : String(units);
}

/** Order number, person or reason (SUP-16). Adjustments name both the person and the reason. */
export function movementSource(movement: Pick<Movement, "type" | "reason" | "source">): string {
  const reason = ADJUST_REASONS.find((option) => option.value === movement.reason)?.label;
  return movement.type === "adjusted" && reason ? `${movement.source}, ${reason.toLowerCase()}` : movement.source;
}

/** The Inventory URL for a view: search text, Low stock only and the open Add product form. */
export function inventoryHref({ q = "", low = false, add = false }: { q?: string; low?: boolean; add?: boolean }): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (low) params.set("low", "1");
  if (add) params.set("add", "1");
  const query = params.toString();
  return query ? `/supplier/inventory?${query}` : "/supplier/inventory";
}
