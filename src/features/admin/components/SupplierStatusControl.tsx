"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, buttonClass } from "@/ui/Button";
import { FormError } from "@/ui/FormError";
import { setSupplierStatusAction } from "../actions";
import { useAdminAction } from "./useAdminAction";

type Status = "active" | "suspended";

type Props = {
  orgId: string;
  name: string;
  status: Status;
  /** A fresh idempotency key from the server render. */
  idempotencyKey: string;
};

const COPY = {
  active: {
    trigger: "Suspend",
    question: "Suspend {name}?",
    detail:
      "Its products are hidden from buyers, new orders are blocked, and pending orders are cancelled with stock released. Buyers are told. Accepted orders can still be delivered.",
    confirm: "Suspend supplier",
    to: "suspended",
  },
  suspended: {
    trigger: "Reactivate",
    question: "Reactivate {name}?",
    detail: "Its products show to connected buyers again and it can take new orders. The supplier and its buyers are told.",
    confirm: "Reactivate supplier",
    to: "active",
  },
} as const;

/** Suspend or Reactivate with a confirm step (ADM-12). */
export function SupplierStatusControl({ orgId, name, status, idempotencyKey }: Props) {
  const [state, formAction, pending] = useAdminAction(setSupplierStatusAction);
  // The status the confirm step was opened for, so its copy does not change while it closes.
  const [confirmingFrom, setConfirmingFrom] = useState<Status | null>(null);
  const [handledAt, setHandledAt] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  const headingId = useId();
  const errorId = useId();

  if (state.status === "ok" && state.at !== handledAt) {
    setHandledAt(state.at);
    setConfirmingFrom(null);
  }

  useEffect(() => {
    if (confirmingFrom) headingRef.current?.focus();
    else if (opened.current) triggerRef.current?.focus();
  }, [confirmingFrom]);

  if (!confirmingFrom) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={buttonClass(status === "active" ? "danger" : "default")}
        onClick={() => {
          opened.current = true;
          setConfirmingFrom(status);
        }}
      >
        {COPY[status].trigger}
      </button>
    );
  }

  const copy = COPY[confirmingFrom];
  const error = state.status === "error" ? state.message : null;
  return (
    <section
      aria-labelledby={headingId}
      className="flex w-full flex-col gap-2.5 rounded-lg border border-bad bg-surface p-3.5 shadow-card"
    >
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="outline-none">
        {copy.question.replace("{name}", name)}
      </h2>
      <p className="text-[.9rem] text-muted">{copy.detail}</p>
      <form action={formAction} className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
        <input type="hidden" name="org" value={orgId} />
        <input type="hidden" name="status" value={copy.to} />
        <input type="hidden" name="key" value={idempotencyKey} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant={confirmingFrom === "active" ? "danger" : "primary"} disabled={pending}>
            {copy.confirm}
          </Button>
          <Button onClick={() => setConfirmingFrom(null)} disabled={pending}>
            Cancel
          </Button>
        </div>
        <FormError id={errorId}>{error}</FormError>
      </form>
    </section>
  );
}
