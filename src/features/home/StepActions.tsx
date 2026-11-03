"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { loadReorderPlanAction, placeReorderPlanAction, skipReorderPlanAction } from "@/features/buyer/home-actions";
import { markAllOutForDeliveryAction } from "@/features/supplier/orderActions";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";

function Done({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[.92rem] font-semibold text-good">
      <Icon name="check" size={18} />
      {text}
    </p>
  );
}

/** Tomorrow's order on Next up: place it now (the cart stays as it is), review it in the cart, or skip today. */
export function PlanStepActions({ orders }: { orders: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // One key for this card, so a second tap after a slow reply places nothing twice.
  const key = useRef(crypto.randomUUID());

  const place = () =>
    start(async () => {
      const result = await placeReorderPlanAction(key.current);
      setMessage(result.ok ? { ok: true, text: result.data } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  const review = () =>
    start(async () => {
      const result = await loadReorderPlanAction();
      if (result.ok) router.push("/buyer/cart");
      else setMessage({ ok: false, text: result.error });
    });
  const skip = () =>
    start(async () => {
      const result = await skipReorderPlanAction();
      setMessage(result.ok ? { ok: true, text: "Skipped for today." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });

  if (message?.ok) return <Done text={message.text} />;
  return (
    <>
      <Button variant="primary" disabled={busy} onClick={place}>
        {busy ? "Working..." : orders > 1 ? `Place ${orders} orders` : "Place order"}
      </Button>
      <Button disabled={busy} onClick={review}>
        Review in cart
      </Button>
      <Button disabled={busy} onClick={skip} className="border-transparent text-muted">
        Not today
      </Button>
      {message ? (
        <p role="alert" className="w-full text-[.84rem] font-semibold text-bad">
          {message.text}
        </p>
      ) : null}
    </>
  );
}

/** Today's orders on Next up: send them all out in one tap. */
export function SendOutStepActions({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const keys = useRef(orderIds.map(() => crypto.randomUUID()));

  const send = () =>
    start(async () => {
      const result = await markAllOutForDeliveryAction(orderIds.map((orderId, index) => ({ orderId, key: keys.current[index] ?? crypto.randomUUID() })));
      setMessage(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });

  if (message?.ok) return <Done text={message.text} />;
  return (
    <>
      <Button variant="primary" disabled={busy} onClick={send}>
        {busy ? "Sending..." : "Mark all out for delivery"}
      </Button>
      <Button disabled={busy} onClick={() => window.print()}>
        <Icon name="receipt" size={16} />
        Print pick list
      </Button>
      {message ? (
        <p role="alert" className="w-full text-[.84rem] font-semibold text-bad">
          {message.text}
        </p>
      ) : null}
    </>
  );
}
