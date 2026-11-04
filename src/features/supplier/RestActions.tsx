"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderView } from "@/features/orders/queries";
import { cancelRestAction } from "@/features/orders/request-actions";
import { Button } from "@/ui/Button";
import { FormError } from "@/ui/FormError";
import { useToast } from "@/ui/Toast";
import { deliverRestAction, markRestOutForDeliveryAction } from "./orderActions";
import { useSupplierForm } from "./useSupplierForm";

type Props = {
  orderId: string;
  status: NonNullable<OrderView["later"]>["status"];
  /** One idempotency key per render; each action here is a different database function, so they share it. */
  idemKey: string;
};

/** The supplier's actions for the rest of a part-accepted order: send it out, deliver it or call it off. */
export function RestActions({ orderId, status, idemKey }: Props) {
  const router = useRouter();
  const toast = useToast();
  const out = useSupplierForm(markRestOutForDeliveryAction);
  const deliver = useSupplierForm(deliverRestAction);
  const [cancelling, startCancel] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const hidden = (
    <>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="key" value={idemKey} />
    </>
  );

  if (status !== "waiting" && status !== "out_for_delivery") return null;

  const cancel = () =>
    startCancel(async () => {
      setCancelError(null);
      const result = await cancelRestAction({ orderId, key: idemKey });
      if (!result.ok) {
        setCancelError(result.error);
        return;
      }
      toast.show(result.message ?? "The rest is cancelled.");
      router.refresh();
    });

  const busy = out.pending || deliver.pending || cancelling;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {status === "waiting" ? (
          <>
            <form onSubmit={out.onSubmit}>
              {hidden}
              <Button type="submit" variant="primary" size="small" disabled={busy}>
                Mark the rest out for delivery
              </Button>
            </form>
            <form onSubmit={deliver.onSubmit}>
              {hidden}
              <Button type="submit" size="small" disabled={busy}>
                Deliver the rest
              </Button>
            </form>
            <Button variant="danger" size="small" disabled={busy} onClick={cancel}>
              Cancel the rest
            </Button>
          </>
        ) : (
          <form onSubmit={deliver.onSubmit}>
            {hidden}
            <Button type="submit" variant="primary" size="small" disabled={busy}>
              Mark the rest delivered
            </Button>
          </form>
        )}
      </div>
      <FormError>{out.error ?? deliver.error ?? cancelError}</FormError>
    </div>
  );
}
