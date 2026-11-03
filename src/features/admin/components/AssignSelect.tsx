"use client";

import { useId, useRef, useState } from "react";
import { FormError } from "@/ui/FormError";
import { assignAttentionAction } from "../actions";
import { useAdminAction } from "./useAdminAction";

type Props = {
  itemKey: string;
  assignedUserId: string | null;
  operators: { userId: string; fullName: string }[];
};

/** "Assigned to" for one attention item. The choice saves as soon as it changes (ADM-04). */
export function AssignSelect({ itemKey, assignedUserId, operators }: Props) {
  const [state, formAction, pending] = useAdminAction(assignAttentionAction);
  const formRef = useRef<HTMLFormElement>(null);
  const selectId = useId();
  const errorId = useId();
  // Controlled, so React's form reset after the action cannot flip the choice back. It follows
  // the saved value when that changes on the server, for example another operator's choice.
  const [value, setValue] = useState(assignedUserId ?? "");
  const [saved, setSaved] = useState(assignedUserId);
  if (saved !== assignedUserId) {
    setSaved(assignedUserId);
    setValue(assignedUserId ?? "");
  }

  const error = state.status === "error" ? state.message : null;
  return (
    <form ref={formRef} action={formAction} className="flex min-w-[160px] flex-col gap-0.5 text-[.72rem] text-muted">
      <input type="hidden" name="item" value={itemKey} />
      <label htmlFor={selectId}>Assigned to</label>
      <select
        id={selectId}
        name="user"
        value={value}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          formRef.current?.requestSubmit();
        }}
        className="min-h-8 rounded-[10px] border border-control-line bg-sunken px-2 py-[5px] text-[.84rem] text-ink disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {operators.map((operator) => (
          <option key={operator.userId} value={operator.userId}>
            {operator.fullName}
          </option>
        ))}
      </select>
      <FormError id={errorId}>{error}</FormError>
    </form>
  );
}
