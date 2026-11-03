"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { logger } from "@/lib/logger";
import { resolveOrigin } from "./origin";
import { passwordUpdateError, validateNewPassword, type PasswordErrors } from "./password";
import { EXPIRED_RESET_PATH, homeFor, safeNextPath, SIGN_IN_PATH, TWO_FACTOR_VERIFY_PATH } from "./routing";

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
const RESET_PATH = "/reset-password";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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
    const limited = error.status === 429;
    return { error: limited ? "Too many attempts. Try again in a few minutes." : "Check your email and password.", email };
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
  const requestHeaders = await headers();
  const origin = resolveOrigin({
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
    host: requestHeaders.get("host"),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!origin) {
    logger.error("auth.password_reset.untrusted_origin");
    return sent;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=${RESET_PATH}`,
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

  const verifyFirst = `${TWO_FACTOR_VERIFY_PATH}?next=${encodeURIComponent(RESET_PATH)}`;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(verifyFirst);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "insufficient_aal") redirect(verifyFirst);
    if (error.code === "session_not_found" || error.code === "session_expired") redirect(EXPIRED_RESET_PATH);
    logger.warn("auth.password_update.rejected", { errorCode: error.code ?? null, status: error.status ?? null });
    return { errors: { password: passwordUpdateError(error) } };
  }

  redirect(`${await roleHome(supabase)}?toast=${encodeURIComponent(PASSWORD_UPDATED)}`);
}
