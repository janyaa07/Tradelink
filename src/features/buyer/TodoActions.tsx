"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TodoAction } from "@/domain/todos";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { answerDeliveryDateAction } from "@/features/orders/request-actions";
import { ackPriceChangeAction, markCreditReceivedAction, markIssueSeenAction, orderRemainderAction, skipPartialAction } from "./home-actions";

/** The buttons on one alert that needs action (BUY-02 to BUY-04). */
export function TodoActions({ action }: { action: TodoAction }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();
  const [creditKey] = useState(() => crypto.randomUUID());

  const run = (call: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) =>
    start(async () => {
      const result = await call();
      show(result.ok ? success : result.error);
      if (result.ok) after?.();
    });

  switch (action.kind) {
    case "price":
      return (
        <Button size="small" disabled={busy} onClick={() => run(() => ackPriceChangeAction(action.id), "Price change noted.")}>
          OK, noted
        </Button>
      );
    case "reply":
      return (
        <Button size="small" disabled={busy} onClick={() => run(() => markIssueSeenAction(action.id), "Reply noted.")}>
          OK
        </Button>
      );
    case "credit":
      return (
        <Button
          variant="primary"
          size="small"
          disabled={busy}
          onClick={() => run(() => markCreditReceivedAction({ issueId: action.id, key: creditKey }), "Credit recorded.")}
        >
          Mark received
        </Button>
      );
    case "partial":
      return (
        <>
          <Button
            variant="primary"
            size="small"
            disabled={busy}
            onClick={() =>
              run(
                () => orderRemainderAction(action.id),
                `${action.remainder} added to your cart.`,
                () => router.push("/buyer/cart"),
              )
            }
          >
            Order the rest<span className="sr-only">, {action.remainder} more</span>
          </Button>
          <Button size="small" disabled={busy} onClick={() => run(() => skipPartialAction(action.id), "Skipped.")}>
            Skip
          </Button>
        </>
      );
    case "date":
      return (
        <>
          <Button
            variant="primary"
            size="small"
            disabled={busy}
            onClick={() => run(() => answerDeliveryDateAction({ requestId: action.id, accept: true, key: creditKey }), "New date agreed.")}
          >
            Accept new date
          </Button>
          <Button
            size="small"
            disabled={busy}
            onClick={() => run(() => answerDeliveryDateAction({ requestId: action.id, accept: false, key: creditKey }), "Date change declined.")}
          >
            Decline
          </Button>
        </>
      );
  }
}
