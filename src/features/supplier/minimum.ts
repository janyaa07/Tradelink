import { minimumGap } from "@/domain/minimum";
import { formatMoney, type Cents } from "@/domain/money";
import type { OrderView } from "@/features/orders/queries";

/**
 * How far an order is under the supplier's current minimum order, in cents; 0 when it is not.
 * Rejected and cancelled orders never count, since nothing will be sent.
 */
export function orderBelowMinimum(order: Pick<OrderView, "status" | "totalCents">, minimumCents: Cents): Cents {
  if (order.status === "rejected" || order.status === "cancelled") return 0;
  return minimumGap(order.totalCents, minimumCents);
}

/** "S$38.05 below your S$40.00 minimum" */
export function belowMinimumNote(gapCents: Cents, minimumCents: Cents): string {
  return `${formatMoney(gapCents)} below your ${formatMoney(minimumCents)} minimum`;
}
