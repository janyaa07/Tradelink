"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { authCardClass, authErrorClass, authSubmitClass } from "@/features/auth/authStyles";
import { CodeForm } from "@/features/auth/CodeForm";
import { formatSecret, TOTP_FRIENDLY_NAME, TWO_FACTOR_MESSAGES } from "@/features/auth/twoFactor";
import { useToast } from "@/ui/Toast";

type Enrolment = { factorId: string; qrCode: string; secret: string };
type SetupState = { status: "loading" } | { status: "failed" } | ({ status: "ready" } & Enrolment);

/** Removes unfinished authenticator-app factors, then starts a new one. */
async function enrol(): Promise<Enrolment> {
  const supabase = createSupabaseBrowserClient();
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  for (const factor of factors.data.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removed.error) throw removed.error;
    }
  }
  const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: TOTP_FRIENDLY_NAME });
  if (enrolled.error) throw enrolled.error;
  return { factorId: enrolled.data.id, qrCode: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret };
}

export function TwoFactorSetup({ destination }: { destination: string }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<SetupState>({ status: "loading" });
  // One enrolment per visit, shared by React's development double-mount, so two factors never race.
  const enrolment = useRef<Promise<Enrolment> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    enrolment.current ??= enrol();
    enrolment.current.then(
      (result) => active && setState({ status: "ready", ...result }),
      () => active && setState({ status: "failed" }),
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    enrolment.current = null;
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  const copySecret = useCallback(async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.show("Key copied.");
    } catch {
      toast.show("Select the key and copy it.");
    }
  }, [toast]);

  const onVerified = useCallback(() => {
    router.refresh();
    router.replace(destination);
  }, [router, destination]);

  if (state.status === "loading") {
    return (
      <div className={authCardClass} aria-busy="true">
        <p role="status">Preparing your QR code...</p>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className={authCardClass}>
        <p role="alert" className={authErrorClass}>
          {TWO_FACTOR_MESSAGES.setupFailed}
        </p>
        <button type="button" onClick={retry} className={authSubmitClass}>
          Try setup again
        </button>
      </div>
    );
  }

  return (
    <div className={authCardClass}>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-[0.92rem]">
        <li>Open an authenticator app, such as Google Authenticator, Microsoft Authenticator or 1Password.</li>
        <li>Scan the QR code, or enter the key by hand.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="self-center rounded-md bg-white p-2.5">
        {/* next/image rejects Supabase's inline SVG data URI, and there is nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.qrCode} alt="QR code for your authenticator app" width={176} height={176} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[0.84rem] font-semibold text-muted">Key for manual entry</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md bg-sunken px-2.5 py-2 font-mono text-[0.9rem]">
            {formatSecret(state.secret)}
          </code>
          <button
            type="button"
            onClick={() => copySecret(state.secret)}
            className="min-h-10 shrink-0 rounded-md border border-line bg-surface px-3 font-semibold text-ink hover:border-accent"
          >
            Copy key
          </button>
        </div>
      </div>
      <CodeForm
        factorId={state.factorId}
        submitLabel="Turn on two-factor sign-in"
        pendingLabel="Checking code..."
        onVerified={onVerified}
      />
    </div>
  );
}
