"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { logger } from "@/lib/logger";
import { resolveOrigin } from "./origin";
import { passwordUpdateError, validateNewPassword, type PasswordErrors } from "./password";
import { EXPIRED_RESET_PATH, homeFor, RESET_PASSWORD_PATH, safeNextPath, SIGN_IN_PATH } from "./routing";
import { readSignUpForm, SIGN_UP_MESSAGES, signUpMetadata, signUpOutcome, validateSignUp, welcomeToast, type SignUpFormState } from "./signUp";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  next: z.string().startsWith("/").optional(),
});

const resetRequestSchema = z.email().max(320);

const newPasswordSchema = z.object({
  password: z.string().max(1000),
  confirm: z.string().max(1000),
});

const PASSWORD_UPDATED = "Password updated.";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The allowlisted origin for links in auth emails, or null when none can be trusted. */
async function emailLinkOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  return resolveOrigin({
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
    host: requestHeaders.get("host"),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

async function roleHome(supabase: SupabaseServerClient): Promise<string> {
  const { data: who } = await supabase.rpc("whoami");
  const kind = who && typeof who === "object" && "kind" in who ? String(who.kind) : null;
  return homeFor(kind) ?? "/";
}

export type SignInState = { error: string | null; email: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = signInSchema.safeParse({
    email,
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Try again in a few minutes.", email };
    // Supabase only reports this after the password matched, so it does not reveal accounts.
    if (error.code === "email_not_confirmed") return { error: "Confirm your email first. Open the link we sent you, then sign in.", email };
    return { error: "Check your email and password.", email };
  }
  const next = safeNextPath(parsed.data.next, "");
  redirect(next || (await roleHome(supabase)));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}

export type ResetRequestState = { sent: boolean; error: string | null; email: string };

/**
 * Emails a password reset link (AUTH-03). The reply is the same whether or not the account
 * exists, and Supabase's per-email limits apply; a rate-limited request shows the same reply.
 */
export async function requestPasswordReset(_previous: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = resetRequestSchema.safeParse(email);
  if (!parsed.success) return { sent: false, error: "Enter a valid email address.", email };

  const sent: ResetRequestState = { sent: true, error: null, email };
  const origin = await emailLinkOrigin();
  if (!origin) {
    logger.error("auth.password_reset.untrusted_origin");
    return sent;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=${RESET_PASSWORD_PATH}`,
  });
  if (error) {
    const limited = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
    const log = limited ? logger.warn : logger.error;
    log("auth.password_reset.failed", { errorCode: error.code ?? null, status: error.status ?? null });
  }
  return sent;
}

export type NewPasswordState = { errors: PasswordErrors & { form?: string } };

/** Sets the new password for the session opened by the emailed link (AUTH-03). */
export async function updatePassword(_previous: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { errors: { form: "Enter and confirm your new password." } };
  const invalid = validateNewPassword(parsed.data.password, parsed.data.confirm);
  if (invalid) return { errors: invalid };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(EXPIRED_RESET_PATH);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "session_not_found" || error.code === "session_expired") redirect(EXPIRED_RESET_PATH);
    logger.warn("auth.password_update.rejected", { errorCode: error.code ?? null, status: error.status ?? null });
    return { errors: { password: passwordUpdateError(error) } };
  }

  redirect(`${await roleHome(supabase)}?toast=${encodeURIComponent(PASSWORD_UPDATED)}`);
}

/**
 * Creates a buyer or supplier account (AUTH-10). The `app.handle_new_user` trigger creates the
 * business; with email confirmation on, the account is usable once the emailed link is opened.
 */
export async function createAccount(_previous: SignUpFormState, formData: FormData): Promise<SignUpFormState> {
  const { password, confirm, ...values } = readSignUpForm(formData);
  const state = (error: string, invalid: SignUpFormState["invalid"] = []): SignUpFormState => ({ error, invalid, notice: null, values });

  const valid = validateSignUp({ ...values, password, confirm });
  if (!valid.ok) return state(valid.error, valid.invalid);

  const origin = await emailLinkOrigin();
  if (!origin) {
    logger.error("auth.sign_up.untrusted_origin");
    return state(SIGN_UP_MESSAGES.failed);
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.auth.signUp({
    email: valid.data.email,
    password: valid.data.password,
    options: { data: signUpMetadata(valid.data), emailRedirectTo: `${origin}/auth/callback?next=/` },
  });

  const outcome = signUpOutcome(result);
  if (outcome.kind === "error") {
    const log = outcome.reason === "unknown" ? logger.error : logger.warn;
    log("auth.sign_up.failed", { reason: outcome.reason, errorCode: result.error?.code ?? null, status: result.error?.status ?? null });
    return state(outcome.message, outcome.invalid);
  }
  if (outcome.kind === "confirmEmail") return { error: null, invalid: [], notice: outcome.message, values };

  const home = homeFor(valid.data.kind) ?? "/";
  redirect(`${home}?toast=${encodeURIComponent(welcomeToast(valid.data.businessName))}`);
}
