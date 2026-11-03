"use client";

import { useState } from "react";
import { OrderCard } from "@/features/orders/OrderCard";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { FormError } from "@/ui/FormError";
import { AcceptForm, PartAcceptForm } from "./AcceptForms";
import { markDeliveredAction, markOutForDeliveryAction, rejectOrderAction } from "./orderActions";
import { useSupplierForm } from "./useSupplierForm";

type Props = {
  order: OrderView;
  /** One idempotency key per render; every form on this card sends it. */
  idemKey: string;
  /** Today and the suggested delivery date in Singapore, as "2026-11-04". */
  minDate: string;
  defaultDate: string;
};

/** An incoming order with the supplier's actions for its state (SUP-03 to SUP-07). */
export function SupplierOrderCard({ order, idemKey, minDate, defaultDate }: Props) {
  const [open, setOpen] = useState<"accept" | "part" | null>(null);
  const reject = useSupplierForm(rejectOrderAction);
  const advance = useSupplierForm(order.status === "accepted" ? markOutForDeliveryAction : markDeliveredAction);
  const unconfirmed = order.lines.filter((line) => !line.held && line.productUnconfirmed).map((line) => line.name);
  const blockedId = `blocked-${order.id}`;
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
    <OrderCard order={order} viewer="supplier" actions={actions}>
      {order.status === "pending" && unconfirmed.length > 0 ? (
        <p id={blockedId} className="text-[.84rem] font-semibold text-warn">
          Confirm stock for {unconfirmed.join(", ")} first.
        </p>
      ) : null}
      {open === "accept" ? (
        <AcceptForm order={order} idemKey={idemKey} minDate={minDate} defaultDate={defaultDate} onClose={close} />
      ) : null}
      {open === "part" ? (
        <PartAcceptForm order={order} idemKey={idemKey} minDate={minDate} defaultDate={defaultDate} onClose={close} />
      ) : null}
      <FormError>{reject.error ?? advance.error}</FormError>
    </OrderCard>
  );
}
