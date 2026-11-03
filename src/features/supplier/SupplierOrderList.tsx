import type { OrderView } from "@/features/orders/queries";
import { EmptyState } from "@/ui/EmptyState";
import { RecordList } from "@/ui/RecordCard";
import { defaultDeliveryDate, todayInSingapore } from "./dates";
import { newIdempotencyKey } from "./keys";
import { SupplierOrderCard } from "./SupplierOrderCard";

type Props = { orders: OrderView[]; now: Date; empty: string };

/** Order cards with supplier actions. Each card gets a fresh idempotency key on every render. */
export function SupplierOrderList({ orders, now, empty }: Props) {
  if (orders.length === 0) return <EmptyState>{empty}</EmptyState>;
  const today = todayInSingapore(now);
  return (
    <RecordList>
      {orders.map((order) => (
        <SupplierOrderCard
          key={order.id}
          order={order}
          idemKey={newIdempotencyKey()}
          minDate={today}
          defaultDate={defaultDeliveryDate(order.requestedDeliveryDate, now)}
        />
      ))}
    </RecordList>
  );
}
