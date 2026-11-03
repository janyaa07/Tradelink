import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { safeNextPath } from "@/features/auth/routing";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · Tradelink" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <AuthScreen title="Sign in" lead="Order, deliver and check stock in one place.">
      <SignInForm next={safeNextPath(next, "") || undefined} />
    </AuthScreen>
  );
}
