"use client";

import { useState, useTransition } from "react";
import { OrderCard } from "@/features/orders/OrderCard";
import type { OrderView } from "@/features/orders/queries";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { orderNumber } from "@/ui/format";
import { useToast } from "@/ui/Toast";
import { cancelOrderAction, confirmAllHereAction, reportNotHereAction } from "./order-actions";
import { ProblemForm } from "./ProblemForm";

type OrderAction = (input: { orderId: string; key: string }) => Promise<ActionResult<unknown>>;

/** An order card with the buyer's actions: Cancel order, All here, Report a problem, Not here yet (BUY-28 to BUY-31). */
export function BuyerOrderCard({ order }: { order: OrderView }) {
  const { show } = useToast();
  const [keys] = useState(() => ({ cancel: crypto.randomUUID(), allHere: crypto.randomUUID(), notHere: crypto.randomUUID() }));
  const [reporting, setReporting] = useState(false);
  const [busy, startAction] = useTransition();
  const ref = orderNumber(order.number);
  const toCheck = order.status === "out_for_delivery" || (order.status === "delivered" && order.checkStatus === "unchecked");

  const run = (action: OrderAction, key: string, success: string) =>
    startAction(async () => {
      const result = await action({ orderId: order.id, key });
      show(result.ok ? success : result.error);
    });

  const actions =
    order.status === "pending" ? (
      <Button variant="danger" disabled={busy} onClick={() => run(cancelOrderAction, keys.cancel, `${ref}: cancelled.`)}>
        Cancel order
      </Button>
    ) : toCheck ? (
      <>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => run(confirmAllHereAction, keys.allHere, `${ref} checked. Your stock is updated.`)}
        >
          All here
        </Button>
        <Button disabled={busy} onClick={() => setReporting(true)} aria-expanded={reporting}>
          Report a problem
        </Button>
        {order.status === "out_for_delivery" ? (
          <Button
            disabled={busy}
            onClick={() => run(reportNotHereAction, keys.notHere, `${order.supplier.name} has been asked for an update.`)}
          >
            Not here yet
          </Button>
        ) : null}
      </>
    ) : null;

  return (
    <OrderCard order={order} viewer="buyer" actions={actions}>
      {reporting && toCheck ? <ProblemForm order={order} onClose={() => setReporting(false)} /> : null}
    </OrderCard>
  );
}
