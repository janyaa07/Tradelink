"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { authCardClass } from "@/features/auth/authStyles";
import { CodeForm } from "@/features/auth/CodeForm";

export function TwoFactorVerify({ factorId, destination }: { factorId: string; destination: string }) {
  const router = useRouter();
  const onVerified = useCallback(() => {
    router.refresh();
    router.replace(destination);
  }, [router, destination]);

  return (
    <div className={authCardClass}>
      <CodeForm factorId={factorId} submitLabel="Verify code" pendingLabel="Checking code..." onVerified={onVerified} />
    </div>
  );
}
