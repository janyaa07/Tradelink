/** New-password rules for AUTH-03. Supabase Auth also checks leaked-password lists. */

export const MIN_PASSWORD_LENGTH = 12;
/** Supabase hashes passwords with bcrypt, which reads at most 72 bytes. */
export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_MESSAGES = {
  tooShort: "Use at least 12 characters.",
  tooLong: "Use 72 characters or fewer.",
  mismatch: "The passwords do not match.",
  weak: "Choose a stronger password. This one has appeared in a data breach or is too weak.",
  samePassword: "Choose a password you have not used here before.",
  failed: "We could not update your password. Try again.",
} as const;

export type PasswordErrors = { password?: string; confirm?: string };

/** Field errors for a new password and its confirmation, or null when both are fine. */
export function validateNewPassword(password: string, confirm: string): PasswordErrors | null {
  const errors: PasswordErrors = {};
  if ([...password].length < MIN_PASSWORD_LENGTH) errors.password = PASSWORD_MESSAGES.tooShort;
  else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) errors.password = PASSWORD_MESSAGES.tooLong;
  if (password !== confirm) errors.confirm = PASSWORD_MESSAGES.mismatch;
  return errors.password || errors.confirm ? errors : null;
}

type AuthErrorLike = { code?: string | undefined; name?: string | undefined; message?: string | undefined };

/** Maps a Supabase `updateUser` error to the copy shown under the form. */
export function passwordUpdateError(error: AuthErrorLike): string {
  if (error.code === "weak_password" || error.name === "AuthWeakPasswordError") return PASSWORD_MESSAGES.weak;
  if (error.code === "same_password") return PASSWORD_MESSAGES.samePassword;
  return PASSWORD_MESSAGES.failed;
}
