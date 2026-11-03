import { redirect } from "next/navigation";
import { requireRole } from "@/data/session";
import { getDraft } from "@/features/ordering/queries";

/** The old Order page: the cart when it has lines, otherwise the assistant to start an order. */
export default async function BuyerOrderPage(): Promise<never> {
  const session = await requireRole("buyer");
  const { lines } = await getDraft(session.userId);
  redirect(lines.length > 0 ? "/buyer/cart" : "/buyer/assistant");
}
