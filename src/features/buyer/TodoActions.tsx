"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { TodoAction } from "@/domain/todos";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { ackPriceChangeAction, markIssueSeenAction, orderRemainderAction, skipPartialAction } from "./home-actions";

/** The buttons on one To do item (BUY-02 to BUY-04). */
export function TodoActions({ action }: { action: TodoAction }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();

  const run = (call: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    start(async () => {
      const result = await call();
      if (!result.ok) show(result.error);
      else after?.();
    });

  if (action.kind === "price") {
    return (
      <Button disabled={busy} onClick={() => run(() => ackPriceChangeAction(action.id))}>
        OK, noted
      </Button>
    );
  }
  if (action.kind === "reply") {
    return (
      <Button disabled={busy} onClick={() => run(() => markIssueSeenAction(action.id))}>
        OK
      </Button>
    );
  }
  return (
    <>
      <Button
        variant="primary"
        disabled={busy}
        onClick={() => run(() => orderRemainderAction(action.id), () => router.push("/buyer/order"))}
      >
        Order the other {action.remainder}
      </Button>
      <Button disabled={busy} onClick={() => run(() => skipPartialAction(action.id))}>
        Skip
      </Button>
    </>
  );
}
