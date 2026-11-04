"use client";

import { useState } from "react";
import type { Cents } from "@/domain/money";
import { OrderCard } from "@/features/orders/OrderCard";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { orderNumber } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";
import { AcceptForm, PartAcceptForm } from "./AcceptForms";
import { belowMinimumNote, orderBelowMinimum } from "./minimum";
import { markDeliveredAction, markOutForDeliveryAction, rejectOrderAction } from "./orderActions";
import { restLabel } from "./orderFilters";
import { useSupplierForm } from "./useSupplierForm";

type Props = {
  order: OrderView;
  /** One idempotency key per render; every form on this card sends it. */
  idemKey: string;
  /** Today and the suggested delivery date in Singapore, as "2026-11-04". */
  minDate: string;
  defaultDate: string;
  /** The supplier's current minimum order. */
  minimumCents: Cents;
};

/** An incoming order with the supplier's actions for its state and a link to its page (SUP-03 to SUP-07). */
export function SupplierOrderCard({ order, idemKey, minDate, defaultDate, minimumCents }: Props) {
  const [open, setOpen] = useState<"accept" | "part" | null>(null);
  const reject = useSupplierForm(rejectOrderAction);
  const advance = useSupplierForm(order.status === "accepted" ? markOutForDeliveryAction : markDeliveredAction);
  const unconfirmed = order.lines.filter((line) => !line.held && line.productUnconfirmed).map((line) => line.name);
  const blockedId = `blocked-${order.id}`;
  const gap = orderBelowMinimum(order, minimumCents);
  const rest = restLabel(order);
  const hidden = (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="key" value={idemKey} />
    </>
  );

  let actions = null;
  if (order.status === "pending" && open === null) {
    actions = (
      <>
        <Button
          variant="primary"
          disabled={unconfirmed.length > 0}
          aria-describedby={unconfirmed.length > 0 ? blockedId : undefined}
          onClick={() => setOpen("accept")}
        >
          Accept order
        </Button>
        <Button onClick={() => setOpen("part")}>Part accept</Button>
        <form onSubmit={reject.onSubmit}>
          {hidden}
          <Button type="submit" variant="danger" disabled={reject.pending}>
            Reject
          </Button>
        </form>
      </>
    );
  } else if (order.status === "accepted" || order.status === "out_for_delivery") {
    actions = (
      <form onSubmit={advance.onSubmit}>
        {hidden}
        <Button type="submit" variant="primary" disabled={advance.pending}>
          {order.status === "accepted" ? "Mark out for delivery" : "Mark delivered"}
        </Button>
      </form>
    );
  }

  const close = () => setOpen(null);
  return (
    <OrderCard
      order={order}
      viewer="supplier"
      actions={
        <>
          <LinkButton variant="text" href={`/supplier/orders/${order.id}`}>
            View order<span className="sr-only"> {orderNumber(order.number)}</span>
          </LinkButton>
          {actions}
        </>
      }
    >
      {rest ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[.84rem] text-muted">
          <Pill tone="info">{rest}</Pill>
          <span>{order.later?.status === "out_for_delivery" ? "The rest is on the way." : "The rest comes in a second delivery."}</span>
        </p>
      ) : null}
      {gap > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[.84rem] text-muted">
          <Pill tone="warn">Below minimum</Pill>
          <span className="num">{belowMinimumNote(gap, minimumCents)}</span>
        </p>
      ) : null}
      {order.status === "pending" && unconfirmed.length > 0 ? (
        <p id={blockedId} className="text-[.84rem] font-semibold text-warn">
          Confirm stock for {unconfirmed.join(", ")} first.
        </p>
      ) : null}
      {open === "accept" ? <AcceptForm order={order} idemKey={idemKey} minDate={minDate} defaultDate={defaultDate} onClose={close} /> : null}
      {open === "part" ? <PartAcceptForm order={order} idemKey={idemKey} minDate={minDate} defaultDate={defaultDate} onClose={close} /> : null}
      <FormError>{reject.error ?? advance.error}</FormError>
    </OrderCard>
  );
}
