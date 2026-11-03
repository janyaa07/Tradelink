import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot your password · Tradelink", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ expired?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { expired } = await searchParams;
  return (
    <AuthScreen title="Forgot your password?" lead="Enter your email and we will send you a link to set a new password.">
      <ForgotPasswordForm expired={expired === "1"} />
    </AuthScreen>
  );
}
