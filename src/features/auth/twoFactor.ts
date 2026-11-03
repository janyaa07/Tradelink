/** Pure helpers for two-factor sign-in with an authenticator app (AUTH-04). */

export const TOTP_FRIENDLY_NAME = "Authenticator app";

export const TWO_FACTOR_MESSAGES = {
  enterCode: "Enter the 6-digit code from your authenticator app.",
  mismatch: "That code did not match. Try the current code.",
  tooMany: "Too many attempts. Try again in a few minutes.",
  failed: "We could not check the code. Try again.",
  setupFailed: "We could not start setup. Try again.",
  enabled: "Two-factor sign-in is on.",
} as const;

/** The 6 digits from what the user typed, allowing spaces and a dash ("123 456"), or null. */
export function parseTotpCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

type AuthErrorLike = { code?: string | undefined; status?: number | undefined };

/** Maps an `mfa.challenge` or `mfa.verify` error to the copy shown under the code field. */
export function codeErrorMessage(error: AuthErrorLike): string {
  if (error.status === 429 || error.code === "over_request_rate_limit") return TWO_FACTOR_MESSAGES.tooMany;
  if (error.code === "mfa_verification_failed" || error.code === "mfa_challenge_expired") return TWO_FACTOR_MESSAGES.mismatch;
  return TWO_FACTOR_MESSAGES.failed;
}

/** "JBSW Y3DP EHPK 3PXP" for easier manual entry. Authenticator apps ignore the spaces. */
export function formatSecret(secret: string): string {
  return secret.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") ?? "";
}
