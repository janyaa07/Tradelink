import type { CatalogueItem } from "@/domain/catalogue";
import type { Draft } from "./draft";

/** A connected supplier the buyer can order from. */
export type SupplierOption = { id: string; name: string; status: "active" | "invited" };

/** What the buyer last paid for a usual item, for the price warning (BUY-17). */
export type UsualOption = { productId: string; lastPaid: string | null };

/** Everything the cart needs, read on the server through the buyer's own session. */
export type CartPageData = {
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
