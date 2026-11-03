"use client";

import { useId, type ReactNode } from "react";
import { FormError } from "@/ui/FormError";
import type { FormAction } from "../formState";
import { useAdminAction } from "./useAdminAction";

type Props = {
  action: FormAction;
  /** Hidden inputs, such as the record id and the idempotency key. */
  fields: Record<string, string>;
  /** The submit button(s). They are disabled while the action runs. */
  children: ReactNode;
  className?: string;
};

/** Runs one admin action: a toast when it works, one error under the form when it does not (SH-05, SH-06). */
export function ActionForm({ action, fields, children, className }: Props) {
  const [state, formAction, pending] = useAdminAction(action);
  const errorId = useId();
  const error = state.status === "error" ? state.message : null;

  return (
    <form action={formAction} className={className} aria-describedby={error ? errorId : undefined}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      <FormError id={errorId}>{error}</FormError>
    </form>
  );
}
