"use client";

import { useActionState } from "react";
import { useToast } from "@/ui/Toast";
import { IDLE, type FormAction, type FormState } from "../formState";

/**
 * Runs an admin server action and shows its toast as soon as it returns. The toast is raised
 * here rather than in an effect because the record often leaves the page with the same render
 * (a resolved dispute, an item marked handled), which would unmount the form first.
 */
export function useAdminAction(action: FormAction) {
  const { show } = useToast();
  return useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.status === "ok") show(result.message);
    return result;
  }, IDLE);
}
