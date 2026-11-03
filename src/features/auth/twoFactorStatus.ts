import "server-only";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { homeFor } from "./routing";

export type TwoFactorStatus = {
  signedIn: boolean;
  /** The user's role home, or "/" when they have no organisation. */
  home: string;
  /** The first verified authenticator-app factor, if any. */
  factor: { id: string; createdAt: string } | null;
  /** True when this session has already passed two-factor (aal2). */
  verifiedSession: boolean;
};

/**
 * Two-factor state for the signed-in user. Uses only `whoami` and Supabase Auth, so it works for a
 * platform user at aal1, before the database lets them read any admin data.
 */
export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { signedIn: false, home: "/", factor: null, verifiedSession: false };

  const [aal, who] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.rpc("whoami")]);
  // getUser() asked the Auth server, so its factor list is current (the session cookie's copy may not be).
  const totp = userData.user.factors?.find((factor) => factor.factor_type === "totp" && factor.status === "verified") ?? null;
  const kind = who.data && typeof who.data === "object" && "kind" in who.data ? String(who.data.kind) : null;

  return {
    signedIn: true,
    home: homeFor(kind) ?? "/",
    factor: totp ? { id: totp.id, createdAt: totp.created_at } : null,
    verifiedSession: aal.data?.currentLevel === "aal2",
  };
}
