"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { t, type Language } from "@/i18n";
import { Button } from "@/ui/Button";
import { refreshToLatest } from "./serviceWorker";
import { APP_VERSION, isBelowMinimum } from "./version";

const RECHECK_MS = 10 * 60 * 1000;
const releaseSchema = z.object({ min_version: z.string() });

/**
 * The forced update rule for the web app (US-50, docs/AI_DESIGN.md section 2.1). When this build is older
 * than `app_release.min_version` for 'web', ordering stops behind a full-screen Refresh. A failed
 * check never blocks: the server still validates every write.
 */
export function UpdateGate({ lang }: { lang: Language }) {
  const [blocked, setBlocked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let lastCheck = 0;
    const supabase = createSupabaseBrowserClient();

    const check = async () => {
      if (Date.now() - lastCheck < RECHECK_MS) return;
      lastCheck = Date.now();
      try {
        const { data, error } = await supabase.from("app_release").select("min_version").eq("platform", "web").maybeSingle();
        const release = releaseSchema.safeParse(data);
        if (cancelled || error || !release.success) return;
        setBlocked(isBelowMinimum(APP_VERSION, release.data.min_version));
      } catch {
        // Offline or unreachable: keep the current answer.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!blocked) return null;

  const refresh = () => {
    setRefreshing(true);
    void refreshToLatest();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-gate-title"
      aria-describedby="update-gate-body"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 64px brand mark */}
      <img src="/icon.svg" alt="" width={64} height={64} />
      <h1 id="update-gate-title" className="max-w-sm text-[1.4rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        {t(lang, "update.gate.title")}
      </h1>
      <p id="update-gate-body" className="max-w-sm text-muted">
        {t(lang, "update.gate.body")}
      </p>
      <Button variant="primary" size="big" className="max-w-xs" onClick={refresh} disabled={refreshing} autoFocus>
        {t(lang, "button.refresh")}
      </Button>
    </div>
  );
}
