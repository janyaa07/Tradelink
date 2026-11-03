"use client";

import { useActionState } from "react";
import { updatePassword, type NewPasswordState } from "@/features/auth/actions";
import { authCardClass, authErrorClass, authInputClass, authLabelClass, authSubmitClass } from "@/features/auth/authStyles";

const initialState: NewPasswordState = { errors: {} };

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  const { password, confirm, form } = state.errors;

  return (
    <form action={action} className={authCardClass} noValidate>
      <label className={authLabelClass}>
        New password
        <input
          className={authInputClass}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-invalid={password ? true : undefined}
          aria-describedby={password ? "password-error" : undefined}
        />
      </label>
      {password ? (
        <p id="password-error" role="alert" className={authErrorClass}>
          {password}
        </p>
      ) : null}
      <label className={authLabelClass}>
        Confirm password
        <input
          className={authInputClass}
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={confirm ? true : undefined}
          aria-describedby={confirm ? "confirm-error" : undefined}
        />
      </label>
      {confirm ? (
        <p id="confirm-error" role="alert" className={authErrorClass}>
          {confirm}
        </p>
      ) : null}
      {form ? (
        <p role="alert" className={authErrorClass}>
          {form}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Saving..." : "Save new password"}
      </button>
    </form>
  );
}
