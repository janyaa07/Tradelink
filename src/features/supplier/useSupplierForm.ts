"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useToast } from "@/ui/Toast";
import type { FormResult } from "./respond";

type Options = {
  /** Checks the form before it is sent; returns the error to show, or null. */
  check?: (form: FormData) => string | null;
  onSuccess?: () => void;
};

/**
 * Submits a supplier form to its server action. On success it shows the toast and calls onSuccess;
 * on failure it shows one error and keeps what the user typed (the form is never reset).
 */
export function useSupplierForm(action: (form: FormData) => Promise<FormResult>, { check, onSuccess }: Options = {}) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The submitter carries the chosen answer when a form has several submit buttons.
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const problem = check?.(form) ?? null;
    setError(problem);
    if (problem) return;
    startTransition(async () => {
      const result = await action(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.message) toast.show(result.message);
      onSuccess?.();
    });
  }

  return { onSubmit, error, pending };
}
