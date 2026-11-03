"use client";

import { useState, useTransition } from "react";
import type { OrderView } from "@/features/orders/queries";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { orderNumber } from "@/ui/format";
import { useToast } from "@/ui/Toast";
import { cancelOrderAction, confirmAllHereAction, markCreditReceivedAction, reportNotHereAction } from "../order-actions";
import { ProblemForm } from "../ProblemForm";
import { needsCheck } from "./filters";

type OrderAction = (input: { orderId: string; key: string }) => Promise<ActionResult<unknown>>;

/** The action bar for the order's state: Cancel order, or All here, Report a problem and Not here yet (BUY-28 to BUY-31). */
export function OrderActions({ order }: { order: OrderView }) {
  const { show } = useToast();
  const [keys] = useState(() => ({ cancel: crypto.randomUUID(), allHere: crypto.randomUUID(), notHere: crypto.randomUUID() }));
  const [reporting, setReporting] = useState(false);
  const [busy, startAction] = useTransition();
  const ref = orderNumber(order.number);
  const toCheck = needsCheck(order);

  const run = (action: OrderAction, key: string, success: string) =>
    startAction(async () => {
      const result = await action({ orderId: order.id, key });
      show(result.ok ? success : result.error);
    });

  if (order.status === "pending") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 rail:flex-row rail:items-center rail:justify-between rail:p-5">
        <p className="text-[.9rem] text-muted">You can cancel until {order.supplier.name} accepts it.</p>
        <Button variant="danger" disabled={busy} onClick={() => run(cancelOrderAction, keys.cancel, `${ref}: cancelled.`)}>
          Cancel order
        </Button>
      </div>
    );
  }
  if (!toCheck) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 rail:p-5">
      <div className="flex flex-col gap-3 rail:flex-row rail:items-center rail:justify-between">
        <p className="text-[.9rem] text-muted">
          {order.status === "out_for_delivery" ? "Check the delivery when it arrives." : "Check the delivery against this order."}
        </p>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
      {reporting ? <ProblemForm order={order} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}

/** Mark credit received, shown when the supplier promised a credit. */
export function CreditReceivedButton({ issueId }: { issueId: string }) {
  const { show } = useToast();
  const [key] = useState(() => crypto.randomUUID());
  const [busy, start] = useTransition();
  return (
    <Button
      disabled={busy}
      onClick={() =>
        start(async () => {
          const result = await markCreditReceivedAction({ issueId, key });
          show(result.ok ? "Credit marked as received." : result.error);
        })
      }
    >
      Mark credit received
    </Button>
  );
}
