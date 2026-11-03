import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { EXPIRED_RESET_PATH } from "@/features/auth/routing";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password · Tradelink", robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(EXPIRED_RESET_PATH);

  return (
    <AuthScreen title="Set a new password" lead="Use at least 12 characters. A long phrase is easier to remember.">
      <ResetPasswordForm />
    </AuthScreen>
  );
}
