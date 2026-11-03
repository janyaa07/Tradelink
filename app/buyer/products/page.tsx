import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { getBuyerCatalogue } from "@/features/buyer/queries";
import { quantitiesByProduct } from "@/features/ordering/line-ops";
import { getDraft } from "@/features/ordering/queries";
import { ProductsBrowser } from "@/features/products/ProductsBrowser";

export const metadata: Metadata = { title: "Products · Tradelink" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BuyerProductsPage({ searchParams }: Props) {
  const session = await requireRole("buyer");
  const q = (await searchParams).q;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.slice(0, 80) ?? "";
  const [catalogue, draft] = await Promise.all([getBuyerCatalogue(), getDraft(session.userId)]);
  return (
    <>
      <h1>Products</h1>
      <ProductsBrowser
        catalogue={catalogue}
        inCart={Object.fromEntries(quantitiesByProduct(draft.lines))}
        cartLines={draft.lines.length}
        initialQuery={initialQuery}
      />
    </>
  );
}
