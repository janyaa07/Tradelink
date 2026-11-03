import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { SIGN_IN_PATH, TWO_FACTOR_VERIFY_PATH } from "@/features/auth/routing";
import { SignOutLink } from "@/features/auth/SignOutLink";
import { TWO_FACTOR_MESSAGES } from "@/features/auth/twoFactor";
import { getTwoFactorStatus } from "@/features/auth/twoFactorStatus";
import { TwoFactorSetup } from "./TwoFactorSetup";

export const metadata: Metadata = { title: "Set up two-factor sign-in · Tradelink", robots: { index: false, follow: false } };

export default async function TwoFactorSetupPage() {
  const status = await getTwoFactorStatus();
  if (!status.signedIn) redirect(SIGN_IN_PATH);
  if (status.factor) redirect(status.verifiedSession ? status.home : TWO_FACTOR_VERIFY_PATH);

  return (
    <AuthScreen
      title="Set up two-factor sign-in"
      lead="Admins enter a code from an authenticator app each time they sign in, so a leaked password is not enough."
    >
      <TwoFactorSetup destination={`${status.home}?toast=${encodeURIComponent(TWO_FACTOR_MESSAGES.enabled)}`} />
      <SignOutLink />
    </AuthScreen>
  );
}
