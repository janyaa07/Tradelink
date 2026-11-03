"use client";

export const SERVICE_WORKER_URL = "/sw.js";
const SWITCH_TIMEOUT_MS = 3000;

/** Production builds register the worker; development only with NEXT_PUBLIC_ENABLE_SW=1, so hot reload stays simple. */
export function serviceWorkerEnabled(): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  return process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";
}

export async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/**
 * Activates a waiting worker (it listens for SKIP_WAITING), waits briefly for it to take control,
 * then reloads. With no waiting worker it just reloads, which fetches the latest app from the network.
 */
export async function refreshToLatest(): Promise<void> {
  const registration = await currentRegistration().catch(() => null);
  const waiting = registration?.waiting;
  if (waiting && navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, SWITCH_TIMEOUT_MS);
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  }
  window.location.reload();
}
