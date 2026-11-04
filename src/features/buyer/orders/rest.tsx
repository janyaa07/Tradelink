import type { OrderView } from "@/features/orders/queries";
import { formatDate } from "@/ui/format";
import { Pill, type PillTone } from "@/ui/Pill";

type Later = NonNullable<OrderView["later"]>;

/** The second delivery's status, as the buyer reads it. */
export const LATER_PILLS: Record<Later["status"], { label: string; tone: PillTone }> = {
  waiting: { label: "Waiting", tone: "warn" },
  out_for_delivery: { label: "On the way", tone: "info" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "plain" },
};

export function LaterStatusPill({ status }: { status: Later["status"] }) {
  return <Pill tone={LATER_PILLS[status].tone}>{LATER_PILLS[status].label}</Pill>;
}

/** The rest of the order while it is still to come: waiting or out for delivery. */
export function restToCome(order: OrderView): Later | null {
  return order.later && (order.later.status === "waiting" || order.later.status === "out_for_delivery") ? order.later : null;
}

/** "Rest on Mon 9 Nov" beside an order's status while the rest is still to come. */
export function RestPill({ order }: { order: OrderView }) {
  const rest = restToCome(order);
  return rest ? <Pill tone="info">Rest on {formatDate(rest.date)}</Pill> : null;
}
