"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { t, type Language } from "@/i18n";
import { useOutbox } from "@/offline/useOutbox";
import { Button } from "@/ui/Button";
import { FOREGROUND_PUSH_EVENT, type PushPayload } from "./push";
import { refreshToLatest, SERVICE_WORKER_URL, serviceWorkerEnabled } from "./serviceWorker";

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Whether the browser thinks it has a network. Server renders assume online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function isPushMessage(data: unknown): data is { type: "PUSH"; payload: PushPayload } {
  return typeof data === "object" && data !== null && "type" in data && data.type === "PUSH" && "payload" in data;
}

/**
 * Registers the service worker, offers "New version ready" when one is waiting, relays pushes that
 * arrive while the app is in front, starts the offline outbox and shows the offline banner (ADR 0016).
 */
export function PwaProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  const { pending } = useOutbox();

  useEffect(() => {
    if (!serviceWorkerEnabled()) return;
    const container = navigator.serviceWorker;
    let registration: ServiceWorkerRegistration | null = null;

    const watchInstalling = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        // With no controller this is the first install, which needs no refresh.
        if (worker.state === "installed" && container.controller) setUpdateReady(true);
      });
    };
    const onUpdateFound = () => watchInstalling(registration?.installing ?? null);

    container
      .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
      .then((registered) => {
        registration = registered;
        if (registered.waiting && container.controller) setUpdateReady(true);
        watchInstalling(registered.installing);
        registered.addEventListener("updatefound", onUpdateFound);
      })
      .catch(() => undefined);

    const onMessage = (event: MessageEvent<unknown>) => {
      if (isPushMessage(event.data)) {
        window.dispatchEvent(new CustomEvent<PushPayload>(FOREGROUND_PUSH_EVENT, { detail: event.data.payload }));
      }
    };
    // A long-lived home screen app checks for a new version whenever it comes back to the front.
    const onVisible = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
    };
    container.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      container.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refresh = () => {
    setRefreshing(true);
    void refreshToLatest();
  };

  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-center gap-2 px-4 pt-[max(8px,env(safe-area-inset-top))]">
        {online ? null : (
          <p
            role="status"
            className="pointer-events-auto w-full max-w-[420px] rounded-[14px] border border-line bg-warn-soft px-[13px] py-[9px] text-center text-[.88rem] font-semibold text-warn shadow-card"
          >
            {t(lang, "offline.banner")}
            {pending > 0 ? ` ${t(lang, "offline.pending", { count: pending })}.` : null}
          </p>
        )}
        {updateReady ? (
          <div
            role="status"
            className="pointer-events-auto flex w-full max-w-[420px] items-center justify-between gap-3 rounded-[14px] bg-ink px-[13px] py-[7px] text-[.88rem] text-bg shadow-card"
          >
            <span>{t(lang, "update.ready")}</span>
            <Button variant="primary" onClick={refresh} disabled={refreshing}>
              {t(lang, "button.refresh")}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
