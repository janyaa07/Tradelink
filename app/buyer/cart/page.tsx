import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { CartWorkspace } from "@/features/ordering/CartWorkspace";
import { getCartPageData } from "@/features/ordering/page-data";

export const metadata: Metadata = { title: "Cart · Tradelink" };

export default async function BuyerCartPage() {
  const session = await requireRole("buyer");
  const data = await getCartPageData(session);
  return <CartWorkspace data={data} />;
}
