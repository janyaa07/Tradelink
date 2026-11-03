import type { ReactNode } from "react";
import { formatMoney, lineTotal } from "@/domain/money";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { formatDate, formatDateTime, orderNumber } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { ProgressSteps, type OrderStatus } from "@/ui/ProgressSteps";
import { RecordCard } from "@/ui/RecordCard";
import type { OrderView } from "./queries";

const STATUS: Record<OrderStatus, { label: string; tone: "good" | "warn" | "bad" | "info" | "plain" }> = {
  pending: { label: "Pending", tone: "warn" },
  accepted: { label: "Accepted", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "plain" },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <Pill tone={STATUS[status].tone}>{STATUS[status].label}</Pill>;
}

type Props = {
  order: OrderView;
  /** Whose view this is: buyers see the supplier, suppliers see the buyer, admins see both. */
  viewer: "buyer" | "supplier" | "admin";
  actions?: ReactNode;
  /** An inline form under the card, such as Report a problem or Part accept. */
  children?: ReactNode;
};

/** The prototype's order card (OrderCard README): other business, number, items, progress, total, actions. */
export function OrderCard({ order, viewer, actions, children }: Props) {
  const other = viewer === "buyer" ? order.supplier : order.buyer;
  const title = viewer === "admin" ? `${order.buyer.name} to ${order.supplier.name}` : other.name;
  const deliveryDate = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  const check =
    order.checkStatus === "all_here" ? (
      <Pill tone="good">All here</Pill>
    ) : order.checkStatus === "problem" ? (
      <Pill tone="warn">Problem reported</Pill>
    ) : null;

  return (
    <RecordCard
      lead={<BusinessLogo name={other.name} size={36} />}
      title={title}
      sub={<span className="font-mono text-[.86em]">{orderNumber(order.number)}</span>}
      pill={<StatusPill status={order.status} />}
      footer={
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{formatDateTime(order.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <b className="num text-ink">{formatMoney(order.totalCents)}</b>
          {deliveryDate ? <span>· Delivery {formatDate(deliveryDate)}</span> : null}
          {check}
        </span>
      }
      actions={actions}
    >
      <ul className="flex flex-col gap-0.5 text-[.9rem]">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <ProductArt kind={line.art} size={26} />
              <span>
                {line.qty} × {line.name}
                {!line.held ? <span className="ml-1 text-[.72rem] font-semibold text-warn">Stock and price to confirm</span> : null}
              </span>
            </span>
            <span className="num text-muted">{formatMoney(lineTotal(line.unitPrice, line.qty))}</span>
          </li>
        ))}
      </ul>
      <ProgressSteps status={order.status} />
      {children}
    </RecordCard>
  );
}
