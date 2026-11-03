"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ResetRequestState } from "@/features/auth/actions";
import { authCardClass, authErrorClass, authInputClass, authLabelClass, authLinkClass, authSubmitClass } from "@/features/auth/authStyles";

const initialState: ResetRequestState = { sent: false, error: null, email: "" };

export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  if (state.sent) {
    return (
      <div className={authCardClass}>
        <p role="status" className="font-semibold">
          If this email has an account, we have sent a reset link.
        </p>
        <p className="text-[0.9rem] text-muted">The link works once, in this browser. Check your spam folder if it does not arrive.</p>
        <Link href="/sign-in" className={authLinkClass}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className={authCardClass} noValidate>
      {expired ? (
        <p role="alert" className={authErrorClass}>
          This link has expired. Ask for a new one.
        </p>
      ) : null}
      <label className={authLabelClass}>
        Email
        <input
          className={authInputClass}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
        />
      </label>
      {state.error ? (
        <p id="email-error" role="alert" className={authErrorClass}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Sending..." : "Send reset link"}
      </button>
      <Link href="/sign-in" className={authLinkClass}>
        Back to sign in
      </Link>
    </form>
  );
}
