import "server-only";
import { minimumGap } from "@/domain/minimum";
import { toCents } from "@/domain/money";
import { getDeliveryTerms } from "@/features/buyer/queries";
import type { OrderView } from "@/features/orders/queries";

/** Each supplier's minimum order in cents, for marking low orders (BUY-24). */
export async function getMinimums(supplierIds: string[]): Promise<Map<string, number>> {
  const terms = await getDeliveryTerms([...new Set(supplierIds)]);
  return new Map([...terms].map(([id, supplierTerms]) => [id, toCents(supplierTerms.minimumOrder ?? "0")]));
}

/** How far a live order is below its supplier's minimum; 0 when it is not, or when it was cancelled or rejected. */
export function orderBelowMinimum(order: OrderView, minimums: Map<string, number>): number {
  if (order.status === "cancelled" || order.status === "rejected") return 0;
  return minimumGap(order.totalCents, minimums.get(order.supplier.id) ?? 0);
}
