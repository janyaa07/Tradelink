"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/features/auth/actions";

const initialState: SignInState = { error: null, email: "" };
const inputClass =
  "w-full rounded-md border border-control-line bg-surface px-3 py-2.5 text-ink";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl bg-surface p-5 text-ink shadow-card" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="flex flex-col gap-1 text-[0.84rem] font-semibold text-muted">
        Email
        <input className={inputClass} name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </label>
      <label className="flex flex-col gap-1 text-[0.84rem] font-semibold text-muted">
        Password
        <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <p role="alert" className="text-[0.84rem] font-semibold text-bad">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-accent px-4 py-2.5 font-bold text-on-accent disabled:opacity-50"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
