"use client";

import { useActionState } from "react";
import { useToast } from "@/ui/Toast";
import { failed, IDLE, type FormAction, type FormState } from "../formState";

/** Shown when the action could not be reached, for example a page opened before a new version went live. */
const UNREACHABLE = "This did not save. Reload the page and try again.";

/**
 * Runs an admin server action and shows its toast as soon as it returns. The toast is raised
 * here rather than in an effect because the record often leaves the page with the same render
 * (a resolved dispute, an item marked handled), which would unmount the form first.
 *
 * A call that throws (no connection, or an action the server no longer has after a deploy)
 * becomes an error under the control, so the page stays usable instead of failing to load.
 */
export function useAdminAction(action: FormAction) {
  const { show } = useToast();
  return useActionState<FormState, FormData>(async (previous, formData) => {
    let result: FormState;
    try {
      result = await action(previous, formData);
    } catch {
      return failed(UNREACHABLE);
    }
    if (result.status === "ok") show(result.message);
    return result;
  }, IDLE);
}
