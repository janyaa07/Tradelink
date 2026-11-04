import type { Cents } from "@/domain/money";
import type { OrderView } from "@/features/orders/queries";
import { EmptyState } from "@/ui/EmptyState";
import { RecordList } from "@/ui/RecordCard";
import { defaultDeliveryDate, todayInSingapore } from "./dates";
import { newIdempotencyKey } from "./keys";
import { SupplierOrderCard } from "./SupplierOrderCard";

type Props = {
  orders: OrderView[];
  now: Date;
  empty: string;
  /** The supplier's current minimum order; orders under it are marked. */
  minimumCents: Cents;
};

/** Order cards with supplier actions, the phone version of the orders table. Each card gets a fresh idempotency key on every render. */
export function SupplierOrderList({ orders, now, empty, minimumCents }: Props) {
  if (orders.length === 0) return <EmptyState>{empty}</EmptyState>;
  const today = todayInSingapore(now);
  return (
    <RecordList>
      {orders.map((order) => (
        <div key={order.id} data-anchor={`order-${order.number}`} className="scroll-mt-20 rounded-lg data-hit:ring-2 data-hit:ring-accent">
          <SupplierOrderCard
            order={order}
            idemKey={newIdempotencyKey()}
            minDate={today}
            defaultDate={defaultDeliveryDate(order.requestedDeliveryDate, now)}
            minimumCents={minimumCents}
          />
        </div>
      ))}
    </RecordList>
  );
}
