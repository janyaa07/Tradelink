import type { CatalogueItem } from "@/domain/catalogue";
import { tokens } from "./rules";

/**
 * Another active product that shares a name word with `item` and has at least `qty` available,
 * in catalogue order. Returns null when nothing suitable is in stock.
 */
export function findSubstitute(item: CatalogueItem, qty: number, catalogue: CatalogueItem[]): CatalogueItem | null {
  const words = new Set(tokens(item.name));
  const substitute = catalogue.find(
    (other) =>
      other.id !== item.id &&
      other.status === "active" &&
      other.available >= qty &&
      tokens(other.name).some((word) => words.has(word)),
  );
  return substitute ?? null;
}
