import type { CatalogueItem } from "@/domain/catalogue";
import type { Draft } from "./draft";

/** A connected supplier the buyer can order from. */
export type SupplierOption = { id: string; name: string; status: "active" | "invited" };

export type UsualOption = { productId: string; usualQty: number; lastPaid: string | null };

/** Everything the Order page needs, read on the server through the buyer's own session. */
export type OrderPageData = {
  draft: Draft;
  catalogue: CatalogueItem[];
  usuals: UsualOption[];
  suppliers: SupplierOption[];
  /** Cut-off line per supplier ID, such as "Order by 16:00 for tomorrow". */
  cutoffs: Record<string, string>;
  weekSpentCents: number;
  budget: string;
  budgetWarning: boolean;
};
