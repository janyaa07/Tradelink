import { healthOf, type CatalogueItem } from "@/domain/catalogue";
import { MAX_LINE_QTY } from "@/domain/review";
import type { PillTone } from "@/ui/Pill";

export type Availability = {
  label: string;
  tone: PillTone;
  /** False when the product cannot be added: active and nothing available. */
  orderable: boolean;
  /** The most the stepper allows: what is available for active products. */
  limit: number;
  /** Why the product cannot be added, shown under the disabled button. */
  reason: string | null;
};

/** The availability pill and ordering limit for a product card. */
export function availabilityOf(item: Pick<CatalogueItem, "status" | "available" | "reorderLevel">): Availability {
  const available = Math.max(0, item.available);
  switch (healthOf(item)) {
    case "unconfirmed":
      return { label: "Stock to confirm", tone: "info", orderable: true, limit: MAX_LINE_QTY, reason: null };
    case "out":
      return { label: "Out of stock", tone: "bad", orderable: false, limit: 0, reason: "None left to order right now." };
    case "low":
      return { label: `Only ${available} left`, tone: "warn", orderable: true, limit: Math.min(available, MAX_LINE_QTY), reason: null };
    case "healthy":
      return { label: `${available} in stock`, tone: "good", orderable: true, limit: Math.min(available, MAX_LINE_QTY), reason: null };
  }
}

/** Matches the search text against the name, aliases and supplier. */
export function matchesSearch(item: Pick<CatalogueItem, "name" | "aliases" | "supplierName">, query: string): boolean {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  return [item.name, item.supplierName, ...item.aliases].some((text) => text.toLowerCase().includes(search));
}
