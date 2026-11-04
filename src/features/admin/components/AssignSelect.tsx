"use client";

import { startTransition, useId, useState } from "react";
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
  const [state, runAction, pending] = useAdminAction(assignAttentionAction);
  const selectId = useId();
  const errorId = useId();
  // The action runs outside a form, because React resets a form after its action and a reset
  // puts a select back on its first option ("Unassigned"). The choice follows the saved value
  // when that changes on the server, for example another operator's choice.
  const [value, setValue] = useState(assignedUserId ?? "");
  const [saved, setSaved] = useState(assignedUserId);
  if (saved !== assignedUserId) {
    setSaved(assignedUserId);
    setValue(assignedUserId ?? "");
  }
  // A save that failed puts the choice back on what is saved, so the select never shows an unsaved name.
  const [failedAt, setFailedAt] = useState(0);
  if (state.status === "error" && state.at !== failedAt) {
    setFailedAt(state.at);
    setValue(assignedUserId ?? "");
  }

  function save(user: string) {
    setValue(user);
    const formData = new FormData();
    formData.set("item", itemKey);
    formData.set("user", user);
    startTransition(() => runAction(formData));
  }

  const error = state.status === "error" ? state.message : null;
  return (
    <div className="flex w-full min-w-[160px] flex-col gap-0.5 text-[.72rem] text-muted min-[420px]:w-auto">
      <label htmlFor={selectId} className="sr-only">
        Assigned to
      </label>
      <select
        id={selectId}
        value={value}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => save(event.target.value)}
        className="min-h-8 w-full rounded-lg border border-line bg-surface px-2 py-[5px] text-[.84rem] text-ink disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {operators.map((operator) => (
          <option key={operator.userId} value={operator.userId}>
            {operator.fullName}
          </option>
        ))}
      </select>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
