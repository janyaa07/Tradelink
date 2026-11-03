import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { CartWorkspace } from "@/features/ordering/CartWorkspace";
import { getCartPageData } from "@/features/ordering/page-data";

export const metadata: Metadata = { title: "Cart · Tradelink" };

export default async function BuyerCartPage() {
  const session = await requireRole("buyer");
  const data = await getCartPageData(session);
  // A new draft version (lines added elsewhere) starts the workspace afresh with the saved lines.
  return <CartWorkspace key={data.draft.version} data={data} />;
}
