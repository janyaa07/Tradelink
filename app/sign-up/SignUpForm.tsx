"use client";

import Link from "next/link";
import { useActionState, type ComponentProps } from "react";
import { createAccount } from "@/features/auth/actions";
import { authCardClass, authErrorClass, authInputClass, authLabelClass, authLinkClass, authSubmitClass } from "@/features/auth/authStyles";
import { initialSignUpState, type SignUpField } from "@/features/auth/signUp";

const ERROR_ID = "sign-up-error";

const KIND_OPTIONS = [
  { value: "buyer", label: "I buy supplies (buyer)" },
  { value: "supplier", label: "I sell supplies (supplier)" },
] as const;

function SignInLink() {
  return (
    <p className="text-[0.9rem] text-muted">
      Already have an account?{" "}
      <Link href="/sign-in" className={authLinkClass}>
        Sign in
      </Link>
    </p>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(createAccount, initialSignUpState);
  const { values } = state;

  if (state.notice) {
    return (
      <div className={authCardClass}>
        <p role="status" className="font-semibold">
          {state.notice}
        </p>
        <p className="text-[0.9rem] text-muted">The link works once, in this browser. Check your spam folder if it does not arrive.</p>
        <Link href="/sign-in" className={authLinkClass}>
          Go to sign in
        </Link>
      </div>
    );
  }

  /** aria-invalid and aria-describedby for a field the form error is about, plus any hint. */
  const describe = (field: SignUpField, hintId?: string): Pick<ComponentProps<"input">, "aria-invalid" | "aria-describedby"> => {
    const invalid = state.error !== null && state.invalid.includes(field);
    const ids = [hintId, invalid ? ERROR_ID : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid ? true : undefined, "aria-describedby": ids || undefined };
  };

  return (
    <form action={action} className={authCardClass} noValidate>
      <fieldset role="radiogroup" aria-required="true" className="flex flex-col gap-2" {...describe("kind")}>
        <legend className="mb-1 text-[0.84rem] font-semibold text-muted">Account type</legend>
        {KIND_OPTIONS.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-md border border-control-line px-3 py-2 text-ink">
            <input
              type="radio"
              name="kind"
              value={option.value}
              required
              defaultChecked={values.kind === option.value}
              className="size-4 accent-accent"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className={authLabelClass}>
        Business name
        <input
          className={authInputClass}
          name="businessName"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={120}
          defaultValue={values.businessName}
          {...describe("businessName")}
        />
      </label>
      <label className={authLabelClass}>
        Your name
        <input
          className={authInputClass}
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={values.fullName}
          {...describe("fullName")}
        />
      </label>
      <label className={authLabelClass}>
        Phone (optional)
        <input
          className={authInputClass}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={17}
          defaultValue={values.phone}
          {...describe("phone")}
        />
      </label>
      <label className={authLabelClass}>
        Email
        <input
          className={authInputClass}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          defaultValue={values.email}
          {...describe("email")}
        />
      </label>
      <label className={authLabelClass}>
        Password
        <input
          className={authInputClass}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          {...describe("password", "password-hint")}
        />
        <span id="password-hint" className="font-normal">
          At least 12 characters. A long phrase is easier to remember.
        </span>
      </label>
      <label className={authLabelClass}>
        Confirm password
        <input className={authInputClass} name="confirm" type="password" autoComplete="new-password" required {...describe("confirm")} />
      </label>
      {state.error ? (
        <p id={ERROR_ID} role="alert" className={authErrorClass}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Creating account..." : "Create account"}
      </button>
      <SignInLink />
    </form>
  );
}
