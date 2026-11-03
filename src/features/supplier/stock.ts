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

export const INVENTORY_FILTERS = ["all", "low", "out", "confirm"] as const;
export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

export const INVENTORY_FILTER_LABELS: Record<InventoryFilter, string> = {
  all: "All",
  low: "Low",
  out: "Out",
  confirm: "To confirm",
};

const FILTER_HEALTH: Record<Exclude<InventoryFilter, "all">, Health> = { low: "low", out: "out", confirm: "unconfirmed" };

export function parseInventoryFilter(value: string): InventoryFilter {
  return INVENTORY_FILTERS.find((filter) => filter === value) ?? "all";
}

/** Filters inventory by name or SKU and by stock state: low, out, or added by a buyer and waiting to be confirmed (SUP-10). */
export function filterInventory<T extends Pick<CatalogueItem, "name" | "sku" | "health">>(items: T[], query: string, filter: InventoryFilter): T[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (item) => (!q || `${item.name} ${item.sku}`.toLowerCase().includes(q)) && (filter === "all" || item.health === FILTER_HEALTH[filter]),
  );
}

export const MOVEMENT_TYPES = ["received", "reserved", "released", "delivered", "adjusted"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
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

/** The reason for an adjustment, such as Damaged. Other changes have none. */
export function movementReason(movement: Pick<Movement, "type" | "reason">): string | null {
  if (movement.type !== "adjusted") return null;
  return ADJUST_REASONS.find((option) => option.value === movement.reason)?.label ?? null;
}

export function parseMovementType(value: string): MovementType | null {
  return MOVEMENT_TYPES.find((type) => type === value) ?? null;
}

/** The Stock history URL for one kind of change, or every change. */
export function stockHistoryHref(type: MovementType | null): string {
  return type ? `/supplier/stock-history?type=${type}` : "/supplier/stock-history";
}

/** The Inventory URL for a view: search text, filter and the open Add product form. */
export function inventoryHref({ q = "", filter = "all", add = false }: { q?: string; filter?: InventoryFilter; add?: boolean }): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (filter !== "all") params.set("filter", filter);
  if (add) params.set("add", "1");
  const query = params.toString();
  return query ? `/supplier/inventory?${query}` : "/supplier/inventory";
}
