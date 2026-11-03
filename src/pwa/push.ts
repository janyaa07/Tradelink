"use client";

import { currentRegistration } from "./serviceWorker";
import { APP_VERSION } from "./version";

export const SUBSCRIBE_URL = "/api/push/subscribe";
/** The window event PwaProvider fires when a push arrives while the app is open and in front. */
export const FOREGROUND_PUSH_EVENT = "restock:push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  notificationId: string | null;
  tag?: string;
};

export type PushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "needs_install" | "denied" | "not_configured" | "no_worker" | "failed" };

/** Converts a base64url VAPID public key into the bytes `pushManager.subscribe` expects. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type IosNavigator = Navigator & { standalone?: boolean };

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but with touch.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** True when the app runs from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as IosNavigator).standalone === true;
}

function browserSupportsPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Whether this device can receive push now. On iPhone and iPad, web push works only once Restock
 * is added to the Home Screen (iOS 16.4 and later), so a Safari tab returns false.
 */
export function canUsePush(): boolean {
  if (!browserSupportsPush()) return false;
  return !isIos() || isStandalone();
}

/** True on iPhone or iPad in a browser tab, where the answer is "add to Home Screen first". */
export function pushNeedsInstall(): boolean {
  return typeof window !== "undefined" && isIos() && !isStandalone();
}

/**
 * Asks for notification permission and saves the subscription on the server. Call it straight from
 * a tap handler: browsers only show the permission prompt in response to a user gesture, so nothing
 * is awaited before the request.
 */
export async function enablePush(): Promise<PushResult> {
  if (pushNeedsInstall()) return { ok: false, reason: "needs_install" };
  if (!canUsePush()) return { ok: false, reason: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, reason: "not_configured" };

  try {
    const registration = await currentRegistration();
    if (!registration) return { ok: false, reason: "no_worker" };
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
    const response = await fetch(SUBSCRIBE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ subscription: subscription.toJSON(), appVersion: APP_VERSION }),
    });
    return response.ok ? { ok: true } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Stops push on this device. The server drops the stored endpoint when the push service reports it gone. */
export async function disablePush(): Promise<boolean> {
  try {
    const registration = await currentRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? await subscription.unsubscribe() : true;
  } catch {
    return false;
  }
}

/** Runs `handler` for pushes that arrive while the app is open and focused. Returns the unsubscribe. */
export function onForegroundPush(handler: (payload: PushPayload) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<PushPayload>).detail);
  window.addEventListener(FOREGROUND_PUSH_EVENT, listener);
  return () => window.removeEventListener(FOREGROUND_PUSH_EVENT, listener);
}
