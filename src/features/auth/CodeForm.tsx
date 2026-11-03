"use client";

import { useActionState } from "react";
import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { authErrorClass, authInputClass, authLabelClass, authSubmitClass } from "./authStyles";
import { codeErrorMessage, parseTotpCode, TWO_FACTOR_MESSAGES } from "./twoFactor";

/** Challenges a TOTP factor and verifies the code. Returns the error to show, or null on success. */
async function verifyTotpCode(factorId: string, input: string): Promise<string | null> {
  const code = parseTotpCode(input);
  if (!code) return TWO_FACTOR_MESSAGES.enterCode;
  const supabase = createSupabaseBrowserClient();
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return codeErrorMessage(challenge.error);
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  return verified.error ? codeErrorMessage(verified.error) : null;
}

type CodeFormProps = {
  factorId: string;
  submitLabel: string;
  pendingLabel: string;
  /** Runs after the code is verified and the session has reached aal2. */
  onVerified: () => void;
};

/** The 6-digit code field shared by two-factor setup and verification. */
export function CodeForm({ factorId, submitLabel, pendingLabel, onVerified }: CodeFormProps) {
  const [error, action, pending] = useActionState(async (_previous: string | null, formData: FormData) => {
    const failure = await verifyTotpCode(factorId, String(formData.get("code") ?? ""));
    if (!failure) onVerified();
    return failure;
  }, null);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <label className={authLabelClass}>
        6-digit code
        <input
          className={`${authInputClass} font-mono text-[1.1rem] tracking-[0.2em]`}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={9}
          required
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "code-error" : undefined}
        />
      </label>
      {error ? (
        <p id="code-error" role="alert" className={authErrorClass}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
