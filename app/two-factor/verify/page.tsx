import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { safeNextPath, SIGN_IN_PATH, TWO_FACTOR_SETUP_PATH } from "@/features/auth/routing";
import { SignOutLink } from "@/features/auth/SignOutLink";
import { getTwoFactorStatus } from "@/features/auth/twoFactorStatus";
import { TwoFactorVerify } from "./TwoFactorVerify";

export const metadata: Metadata = { title: "Enter your code · Tradelink", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function TwoFactorVerifyPage({ searchParams }: Props) {
  const status = await getTwoFactorStatus();
  if (!status.signedIn) redirect(SIGN_IN_PATH);
  const destination = safeNextPath((await searchParams).next, status.home);
  if (!status.factor) redirect(TWO_FACTOR_SETUP_PATH);
  if (status.verifiedSession) redirect(destination);

  return (
    <AuthScreen title="Enter your code" lead="Open your authenticator app and enter the 6-digit code for Tradelink.">
      <TwoFactorVerify factorId={status.factor.id} destination={destination} />
      <SignOutLink />
    </AuthScreen>
  );
}
