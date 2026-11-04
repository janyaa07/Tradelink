"use client";

import { useState, type ReactNode } from "react";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { FormError } from "@/ui/FormError";
import { AcceptForm, PartAcceptForm } from "./AcceptForms";
import { markDeliveredAction, markOutForDeliveryAction, rejectOrderAction } from "./orderActions";
import { useSupplierForm } from "./useSupplierForm";

type Props = {
  order: OrderView;
  /** One idempotency key per render; every form here sends it. */
  idemKey: string;
  /** Today and the suggested delivery date in Singapore, as "2026-11-04". */
  minDate: string;
  defaultDate: string;
  /** Products a buyer added that need their stock confirmed before the order can be accepted. */
  unconfirmed: string[];
  /** The order's heading: buyer, status and dates. */
  children: ReactNode;
};

/** The order page's heading with the supplier's actions for its state on the right; Accept and Part accept open below it (SUP-03 to SUP-07). */
export function OrderPageActions({ order, idemKey, minDate, defaultDate, unconfirmed, children }: Props) {
  const [open, setOpen] = useState<"accept" | "part" | null>(null);
  const reject = useSupplierForm(rejectOrderAction);
  const advance = useSupplierForm(order.status === "accepted" ? markOutForDeliveryAction : markDeliveredAction);
  const blocked = order.status === "pending" && unconfirmed.length > 0;
  const blockedId = `blocked-${order.id}`;
  const close = () => setOpen(null);
  const hidden = (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="key" value={idemKey} />
    </>
  );

  let actions: ReactNode = null;
  if (order.status === "pending" && open === null) {
    actions = (
      <>
        <Button variant="primary" disabled={blocked} aria-describedby={blocked ? blockedId : undefined} onClick={() => setOpen("accept")}>
          Accept order
        </Button>
        <Button onClick={() => setOpen("part")}>Part accept</Button>
        <form onSubmit={reject.onSubmit}>
          {hidden}
          <Button type="submit" variant="danger" disabled={reject.pending}>
            Reject order
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-80">{children}</div>
        {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>
      {blocked ? (
        <p id={blockedId} className="text-[.84rem] font-semibold text-warn">
          Confirm stock for {unconfirmed.join(", ")} before you accept this order.
        </p>
      ) : null}
      {open === "accept" ? <AcceptForm order={order} idemKey={idemKey} minDate={minDate} defaultDate={defaultDate} onClose={close} /> : null}
      {open === "part" ? <PartAcceptForm order={order} idemKey={idemKey} minDate={minDate} defaultDate={defaultDate} onClose={close} /> : null}
      <FormError>{reject.error ?? advance.error}</FormError>
    </div>
  );
}
