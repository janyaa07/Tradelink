import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/data/session";
import { orderOfIssue } from "@/features/orders/issue-order";

type Props = { params: Promise<{ id: string }> };

/** A problem's own link (from alerts) opens its order at the Problems card. */
export default async function SupplierIssuePage({ params }: Props) {
  await requireRole("supplier");
  const orderId = await orderOfIssue((await params).id);
  if (!orderId) notFound();
  redirect(`/supplier/orders/${orderId}#problems`);
}
