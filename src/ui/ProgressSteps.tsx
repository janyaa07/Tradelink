export type OrderStatus = "pending" | "accepted" | "out_for_delivery" | "delivered" | "rejected" | "cancelled";

const STEPS = [
  { status: "pending", label: "Placed" },
  { status: "accepted", label: "Accepted" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
] as const;

type ProgressStepsProps = {
  status: OrderStatus;
};

/** Where an order is. Rejected and cancelled orders show a Pill instead, so this renders nothing. */
export function ProgressSteps({ status }: ProgressStepsProps) {
  const reached = STEPS.findIndex((step) => step.status === status);
  if (reached < 0) return null;

  return (
    <ol aria-label="Order progress" className="grid grid-cols-4 gap-1 text-[.72rem] text-muted">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        const current = index === reached;
        return (
          <li
            key={step.status}
            aria-current={current ? "step" : undefined}
            className={`rounded-[2px] border-t-4 pt-1 ${done ? "border-accent text-ink" : "border-line"} ${current ? "font-bold" : ""}`}
          >
            {step.label}
            {done && !current ? <span className="sr-only"> (done)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
