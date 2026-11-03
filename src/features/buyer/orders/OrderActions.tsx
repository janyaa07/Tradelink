"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { OrderView } from "@/features/orders/queries";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { orderNumber } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { useToast } from "@/ui/Toast";
import { cancelOrderAction, confirmAllHereAction, markCreditReceivedAction, reportNotHereAction } from "../order-actions";
import { ProblemForm } from "../ProblemForm";
import { needsCheck } from "./filters";

type OrderAction = (input: { orderId: string; key: string }) => Promise<ActionResult<unknown>>;

type Props = {
  order: OrderView;
  /** A line's Report link opens the form with that product chosen. */
  reportProductId?: string;
  /** The order's title block; the buttons sit beside it on a laptop. */
  children: ReactNode;
};

/** The order header with the buttons for its state: Cancel order, or All here, Report a problem and Not here yet (BUY-28 to BUY-31). */
export function OrderActions({ order, reportProductId, children }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [keys] = useState(() => ({ cancel: crypto.randomUUID(), allHere: crypto.randomUUID(), notHere: crypto.randomUUID() }));
  const toCheck = needsCheck(order);
  const [reporting, setReporting] = useState(toCheck && Boolean(reportProductId));
  const [busy, startAction] = useTransition();
  const ref = orderNumber(order.number);
  const outForDelivery = order.status === "out_for_delivery";

  const run = (action: OrderAction, key: string, success: string) =>
    startAction(async () => {
      const result = await action({ orderId: order.id, key });
      show(result.ok ? success : result.error);
    });

  /** Closing drops a line's ?report= too, so its Report link opens the form again. */
  const closeReport = () => {
    setReporting(false);
    if (reportProductId) router.replace(`/buyer/orders/${order.id}`, { scroll: false });
  };

  const hint =
    order.status === "pending"
      ? `You can cancel until ${order.supplier.name} accepts it.`
      : toCheck
        ? outForDelivery
          ? "Check the delivery when it arrives."
          : "Check the delivery against this order."
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rail:flex-row rail:items-center rail:gap-5">
        <div className="min-w-0 flex-1">
          {children}
          {hint ? <p className="mt-1 text-[.84rem] text-muted">{hint}</p> : null}
        </div>
        {order.status === "pending" ? (
          <div className="flex flex-wrap gap-2 rail:flex-none">
            <Button variant="danger" disabled={busy} onClick={() => run(cancelOrderAction, keys.cancel, `${ref}: cancelled.`)}>
              Cancel order
            </Button>
          </div>
        ) : null}
        {toCheck ? (
          <div className="flex flex-wrap gap-2 rail:flex-none">
            {outForDelivery ? (
              <Button disabled={busy} onClick={() => run(reportNotHereAction, keys.notHere, `${order.supplier.name} has been asked for an update.`)}>
                Not here yet
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => setReporting(true)} aria-expanded={reporting}>
              Report a problem
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(confirmAllHereAction, keys.allHere, `${ref} checked. Your stock is updated.`)}
            >
              <Icon name="check" size={16} />
              All here
            </Button>
          </div>
        ) : null}
      </div>
      {reporting ? (
        <div id="report" className="scroll-mt-6">
          <ProblemForm order={order} initialProductId={reportProductId} onClose={closeReport} />
        </div>
      ) : null}
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
      size="small"
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
