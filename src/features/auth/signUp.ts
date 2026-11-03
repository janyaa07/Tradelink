/**
 * Self sign-up for buyers and suppliers (AUTH-10, D13). The `app.handle_new_user` trigger on
 * `auth.users` turns the `tl_*` metadata into an organisation, profile, membership and settings,
 * and only accepts buyer or supplier, so sign-up can never create an admin.
 */

import { z } from "zod";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, PASSWORD_MESSAGES } from "./password";

export const ACCOUNT_KINDS = ["buyer", "supplier"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const SIGN_UP_FIELDS = ["kind", "businessName", "fullName", "phone", "email", "password", "confirm"] as const;
export type SignUpField = (typeof SIGN_UP_FIELDS)[number];

const PHONE_PATTERN = /^\+?[0-9 ]{8,16}$/;

export const SIGN_UP_MESSAGES = {
  kind: "Choose whether you buy or sell supplies.",
  businessName: "Enter your business name, 2 to 120 characters.",
  fullName: "Enter your name, 2 to 120 characters.",
  phone: "Enter a phone number of 8 to 16 digits, or leave it blank.",
  email: "Enter a valid email address.",
  passwordTooShort: PASSWORD_MESSAGES.tooShort,
  passwordTooLong: PASSWORD_MESSAGES.tooLong,
  confirm: PASSWORD_MESSAGES.mismatch,
  weakPassword: PASSWORD_MESSAGES.weak,
  checkEmail: "Check your email to confirm your account, then sign in.",
  alreadyRegistered: "An account with this email already exists. Sign in instead.",
  businessNameTaken: "We could not create this account. That business name may already be in use. Try another name.",
  rateLimited: "Too many attempts. Try again in a few minutes.",
  failed: "We could not create your account. Try again.",
} as const;

export function welcomeToast(businessName: string): string {
  return `Welcome to Tradelink, ${businessName}.`;
}

const name = (message: string) => z.string({ error: message }).trim().min(2, { error: message }).max(120, { error: message });

export const signUpSchema = z
  .object({
    kind: z.enum(ACCOUNT_KINDS, { error: SIGN_UP_MESSAGES.kind }),
    businessName: name(SIGN_UP_MESSAGES.businessName),
    fullName: name(SIGN_UP_MESSAGES.fullName),
    phone: z
      .string({ error: SIGN_UP_MESSAGES.phone })
      .trim()
      .refine((value) => value === "" || PHONE_PATTERN.test(value), { error: SIGN_UP_MESSAGES.phone })
      .transform((value) => value || null),
    email: z.string({ error: SIGN_UP_MESSAGES.email }).trim().pipe(z.email({ error: SIGN_UP_MESSAGES.email }).max(320, { error: SIGN_UP_MESSAGES.email })),
    password: z
      .string({ error: SIGN_UP_MESSAGES.passwordTooShort })
      .refine((value) => [...value].length >= MIN_PASSWORD_LENGTH, { error: SIGN_UP_MESSAGES.passwordTooShort, abort: true })
      // Supabase hashes with bcrypt, which reads at most 72 bytes.
      .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, { error: SIGN_UP_MESSAGES.passwordTooLong }),
    confirm: z.string({ error: SIGN_UP_MESSAGES.confirm }),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    error: SIGN_UP_MESSAGES.confirm,
    // Also check when other fields failed, so one attempt lists every fix.
    when: ({ value }) => {
      const fields = value as { password?: unknown; confirm?: unknown };
      return typeof fields.password === "string" && typeof fields.confirm === "string";
    },
  });

export type SignUpInput = z.output<typeof signUpSchema>;

/** The values the form keeps after a failed attempt. Passwords are never sent back. */
export type SignUpValues = { kind: string; businessName: string; fullName: string; phone: string; email: string };

export type SignUpFormState = {
  /** One message under the form saying what to fix, or null. */
  error: string | null;
  /** The fields the error is about, marked aria-invalid. */
  invalid: SignUpField[];
  /** Set when the account was created and the email must be confirmed. */
  notice: string | null;
  values: SignUpValues;
};

export const EMPTY_SIGN_UP_VALUES: SignUpValues = { kind: "", businessName: "", fullName: "", phone: "", email: "" };

export const initialSignUpState: SignUpFormState = { error: null, invalid: [], notice: null, values: EMPTY_SIGN_UP_VALUES };

/** Reads the form. Missing fields become empty strings so every rule reports its own message. */
export function readSignUpForm(formData: FormData): SignUpValues & { password: string; confirm: string } {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    kind: text("kind"),
    businessName: text("businessName"),
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
    password: text("password"),
    confirm: text("confirm"),
  };
}

export type SignUpValidation = { ok: true; data: SignUpInput } | { ok: false; error: string; invalid: SignUpField[] };

function isSignUpField(value: unknown): value is SignUpField {
  return typeof value === "string" && (SIGN_UP_FIELDS as readonly string[]).includes(value);
}

/** Validates the form; on failure, one message listing each fix in field order. */
export function validateSignUp(input: unknown): SignUpValidation {
  const parsed = signUpSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const byField = new Map<SignUpField, string>();
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (isSignUpField(field) && !byField.has(field)) byField.set(field, issue.message);
  }
  const invalid = SIGN_UP_FIELDS.filter((field) => byField.has(field));
  if (invalid.length === 0) return { ok: false, error: SIGN_UP_MESSAGES.failed, invalid: [] };
  return { ok: false, error: invalid.map((field) => byField.get(field)).join(" "), invalid };
}

/** The `options.data` sent to `auth.signUp`, read by `app.handle_new_user`. */
export function signUpMetadata(input: SignUpInput) {
  return {
    tl_kind: input.kind,
    tl_business_name: input.businessName,
    tl_full_name: input.fullName,
    tl_phone: input.phone,
  };
}

type AuthErrorLike = { code?: string | undefined; status?: number | undefined; message?: string | undefined };
type SignUpResultLike = {
  data: { user: { identities?: unknown[] | undefined } | null; session: unknown } | null;
  error: AuthErrorLike | null;
};

export type SignUpOutcome =
  | { kind: "signedIn" }
  | { kind: "confirmEmail"; message: string }
  | { kind: "error"; message: string; invalid: SignUpField[]; reason: SignUpFailure };

export type SignUpFailure = "already_registered" | "business_name_taken" | "rate_limited" | "weak_password" | "invalid_email" | "unknown";

const RATE_LIMIT_CODES = new Set(["over_request_rate_limit", "over_email_send_rate_limit"]);
const EXISTS_CODES = new Set(["user_already_exists", "email_exists"]);

function failure(reason: SignUpFailure): SignUpOutcome {
  switch (reason) {
    case "already_registered":
      return { kind: "error", reason, message: SIGN_UP_MESSAGES.alreadyRegistered, invalid: ["email"] };
    case "business_name_taken":
      return { kind: "error", reason, message: SIGN_UP_MESSAGES.businessNameTaken, invalid: ["businessName"] };
    case "rate_limited":
      return { kind: "error", reason, message: SIGN_UP_MESSAGES.rateLimited, invalid: [] };
    case "weak_password":
      return { kind: "error", reason, message: SIGN_UP_MESSAGES.weakPassword, invalid: ["password"] };
    case "invalid_email":
      return { kind: "error", reason, message: SIGN_UP_MESSAGES.email, invalid: ["email"] };
    case "unknown":
      return { kind: "error", reason, message: SIGN_UP_MESSAGES.failed, invalid: [] };
  }
}

function errorReason(error: AuthErrorLike): SignUpFailure {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (error.status === 429 || RATE_LIMIT_CODES.has(code)) return "rate_limited";
  if (EXISTS_CODES.has(code) || /already registered/i.test(message)) return "already_registered";
  if (code === "weak_password") return "weak_password";
  if (code === "email_address_invalid") return "invalid_email";
  // The trigger raised (for example a duplicate business name); Supabase hides the reason.
  if (code === "unexpected_failure" || /database error/i.test(message)) return "business_name_taken";
  return "unknown";
}

/** Maps the result of `auth.signUp` to what the form shows. */
export function signUpOutcome({ data, error }: SignUpResultLike): SignUpOutcome {
  if (error) return failure(errorReason(error));
  const user = data?.user ?? null;
  // With email confirmation on, an existing email returns an obfuscated user with no identities.
  if (user && Array.isArray(user.identities) && user.identities.length === 0) return failure("already_registered");
  if (data?.session) return { kind: "signedIn" };
  if (user) return { kind: "confirmEmail", message: SIGN_UP_MESSAGES.checkEmail };
  return failure("unknown");
}
