"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type SignInState } from "@/features/auth/actions";
import { authCardClass, authErrorClass, authInputClass, authLabelClass, authLinkClass, authSubmitClass } from "@/features/auth/authStyles";

const initialState: SignInState = { error: null, email: "" };

export function SignInForm({ next, linkExpired = false }: { next?: string; linkExpired?: boolean }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  return (
    <form action={action} className={authCardClass} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {linkExpired && !state.error ? (
        <p role="status" className="text-[0.9rem] font-semibold text-ink">
          This link has expired or was already used. Try signing in.
        </p>
      ) : null}
      <label className={authLabelClass}>
        Email
        <input className={authInputClass} name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </label>
      <label className={authLabelClass}>
        Password
        <input className={authInputClass} name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <p role="alert" className={authErrorClass}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
      <Link href="/forgot-password" className={authLinkClass}>
        Forgot your password?
      </Link>
      <p className="text-[0.9rem] text-muted">
        New to Tradelink?{" "}
        <Link href="/sign-up" className={authLinkClass}>
          Create an account
        </Link>
      </p>
    </form>
  );
}
