"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { answerDeliveryDateAction } from "./request-actions";

/** Accept or decline the other side's new delivery date, from a list such as the bell's pop-up. */
export function DateRequestButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();
  const [key] = useState(() => crypto.randomUUID());
  const answer = (accept: boolean) =>
    start(async () => {
      const result = await answerDeliveryDateAction({ requestId, accept, key });
      show(result.ok ? (result.message ?? "Done.") : result.error);
      if (result.ok) router.refresh();
    });
  return (
    <>
      <Button variant="primary" size="small" disabled={busy} onClick={() => answer(true)}>
        Accept new date
      </Button>
      <Button size="small" disabled={busy} onClick={() => answer(false)}>
        Decline
      </Button>
    </>
  );
}
