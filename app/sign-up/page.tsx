import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create an account · Tradelink" };

export default function SignUpPage() {
  return (
    <AuthScreen title="Create an account" lead="Set up your business on Tradelink to order or sell supplies.">
      <SignUpForm />
    </AuthScreen>
  );
}
