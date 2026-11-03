import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { plural } from "@/domain/catalogue";
import { AvailabilityBrowser } from "@/features/buyer/AvailabilityBrowser";
import { getBuyerCatalogue } from "@/features/buyer/queries";
import { quantitiesByProduct } from "@/features/ordering/line-ops";
import { getDraft } from "@/features/ordering/queries";

export const metadata: Metadata = { title: "Availability · Tradelink" };

export default async function BuyerAvailabilityPage() {
  const session = await requireRole("buyer");
  const [catalogue, draft] = await Promise.all([getBuyerCatalogue(), getDraft(session.userId)]);
  return (
    <>
      <div className="flex flex-col gap-[3px]">
        <h1>Availability</h1>
        <p className="text-muted">All {plural(catalogue.length, "catalogue product")}, including items that are out of stock.</p>
      </div>
      <div className="flex flex-col gap-3 @container">
        <AvailabilityBrowser catalogue={catalogue} inOrder={Object.fromEntries(quantitiesByProduct(draft.lines))} />
      </div>
    </>
  );
}
