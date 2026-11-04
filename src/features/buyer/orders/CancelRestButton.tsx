"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelRestAction } from "@/features/orders/request-actions";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

/** Calls off the second delivery while it is still waiting to go out. */
export function CancelRestButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [key] = useState(() => crypto.randomUUID());
  const [busy, start] = useTransition();
  return (
    <Button
      size="small"
      variant="danger"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const result = await cancelRestAction({ orderId, key });
          show(result.ok ? (result.message ?? "The rest is cancelled.") : result.error);
          if (result.ok) router.refresh();
        })
      }
    >
      Cancel the rest
    </Button>
  );
}
