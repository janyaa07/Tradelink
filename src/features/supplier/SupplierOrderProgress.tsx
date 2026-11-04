import type { OrderView } from "@/features/orders/queries";
import { cx } from "@/ui/cx";
import { formatDate, formatDateTime } from "@/ui/format";

type Step = { label: string; note: string; turn?: boolean };

const REST_STATE: Record<NonNullable<OrderView["later"]>["status"], string> = {
  waiting: "waiting",
  out_for_delivery: "on the way",
  delivered: "delivered",
  cancelled: "cancelled",
};

const REACHED: Partial<Record<OrderView["status"], number>> = { pending: 0, accepted: 1, out_for_delivery: 2, delivered: 3 };

function stepsFor(order: OrderView, reached: number): Step[] {
  const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  return [
    { label: "Placed", note: formatDateTime(order.createdAt) },
    {
      label: "Accepted",
      note: reached === 0 ? "Your turn" : order.confirmedDeliveryDate ? `For ${formatDate(order.confirmedDeliveryDate)}` : "",
      turn: reached === 0,
    },
    { label: "Out for delivery", note: reached === 1 ? "Your turn" : reached === 2 ? "On the way" : "", turn: reached === 1 },
    {
      label: "Delivered",
      note: reached === 2 ? "Your turn" : delivery ? (reached >= 3 ? formatDate(delivery) : `Due ${formatDate(delivery)}`) : "",
      turn: reached === 2,
    },
  ];
}

/** Where the order is, from placed to delivered, with the supplier's next step marked. Rejected and cancelled orders show only their status pill. */
export function SupplierOrderProgress({ order }: { order: OrderView }) {
  const reached = REACHED[order.status];
  if (reached === undefined) return null;
  const steps = stepsFor(order, reached);
  const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  const rest = order.later && order.later.status !== "cancelled" ? order.later : null;

  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Order progress" className="grid grid-cols-4 gap-1.5">
        {steps.map((step, index) => {
          const done = index <= reached;
          return (
            <li key={step.label} aria-current={index === reached ? "step" : undefined} className="flex min-w-0 flex-col">
              <span aria-hidden="true" className={cx("h-1 rounded-full", done ? "bg-accent" : "bg-line")} />
              <span className={cx("mt-1.5 text-[.75rem] leading-tight font-semibold", step.turn ? "text-warn" : done ? "text-ink" : "text-muted")}>
                {step.label}
                {index < reached ? <span className="sr-only"> (done)</span> : null}
              </span>
              {step.note ? <span className="num hidden text-[.72rem] text-muted min-[480px]:block">{step.note}</span> : null}
            </li>
          );
        })}
      </ol>
      {rest ? (
        <p className="num text-[.8rem] text-muted">
          Two deliveries: {delivery ? `the first on ${formatDate(delivery)}, ` : ""}the rest on {formatDate(rest.date)} ({REST_STATE[rest.status]}).
        </p>
      ) : null}
    </div>
  );
}
