import type { OrderView } from "@/features/orders/queries";
import { cx } from "@/ui/cx";
import { formatDate, formatDateTime } from "@/ui/format";
import { needsCheck } from "./filters";

type Step = { label: string; note: string; turn?: boolean };

const REACHED: Partial<Record<OrderView["status"], number>> = { pending: 0, accepted: 1, out_for_delivery: 2, delivered: 3 };

function stepsFor(order: OrderView, reached: number): Step[] {
  const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  const yourTurn = order.status === "delivered" && needsCheck(order);
  const checkNote =
    order.checkStatus === "all_here" ? "All here" : order.checkStatus === "problem" ? "Problem reported" : yourTurn ? "Your turn" : "";
  return [
    { label: "Placed", note: formatDateTime(order.createdAt) },
    {
      label: "Accepted",
      note:
        reached >= 1 && order.confirmedDeliveryDate ? `For ${formatDate(order.confirmedDeliveryDate)}` : reached === 0 ? "Waiting for supplier" : "",
    },
    { label: "Out for delivery", note: reached === 2 ? "On the way" : "" },
    { label: "Delivered", note: delivery ? (reached >= 3 ? formatDate(delivery) : `Due ${formatDate(delivery)}`) : "" },
    { label: "Checked", note: checkNote, turn: yourTurn },
  ];
}

/** Where the order is, from placed to checked. Rejected and cancelled orders show only their status pill. */
export function OrderProgress({ order }: { order: OrderView }) {
  const status = REACHED[order.status];
  if (status === undefined) return null;
  const reached = status === 3 && order.checkStatus !== "unchecked" ? 4 : status;
  const steps = stepsFor(order, reached);

  return (
    <ol aria-label="Order progress" className="grid grid-cols-5 gap-1.5">
      {steps.map((step, index) => {
        const done = index <= reached;
        return (
          <li key={step.label} aria-current={index === reached ? "step" : undefined} className="flex min-w-0 flex-col">
            <span aria-hidden="true" className={cx("h-1 rounded-full", done ? "bg-accent" : "bg-line")} />
            <span className={cx("mt-1.5 text-[.75rem] font-semibold leading-tight", step.turn ? "text-warn" : done ? "text-ink" : "text-muted")}>
              {step.label}
              {index < reached ? <span className="sr-only"> (done)</span> : null}
            </span>
            {step.note ? <span className="num hidden text-[.72rem] text-muted min-[480px]:block">{step.note}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
