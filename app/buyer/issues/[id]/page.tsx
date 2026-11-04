import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/data/session";
import { orderOfIssue } from "@/features/orders/issue-order";

type Props = { params: Promise<{ id: string }> };

/** A problem's own link (from alerts) opens its order at the Problems card. */
export default async function BuyerIssuePage({ params }: Props) {
  await requireRole("buyer");
  const orderId = await orderOfIssue((await params).id);
  if (!orderId) notFound();
  redirect(`/buyer/orders/${orderId}#problems`);
}
