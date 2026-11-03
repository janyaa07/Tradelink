import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { OrderWorkspace } from "@/features/ordering/OrderWorkspace";
import { getOrderPageData } from "@/features/ordering/page-data";

export const metadata: Metadata = { title: "Order · Tradelink" };

export default async function BuyerOrderPage() {
  const session = await requireRole("buyer");
  const data = await getOrderPageData(session);
  return <OrderWorkspace data={data} />;
}
