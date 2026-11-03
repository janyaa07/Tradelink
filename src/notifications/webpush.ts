import "server-only";
import * as webpush from "web-push";
import { z } from "zod";
import type { PushPayload, PushSubscriptionRecord } from "./subscription";

const vapidSchema = z.object({
  publicKey: z.string().min(20),
  privateKey: z.string().min(20),
  subject: z.string().regex(/^(mailto:|https:\/\/)/),
});

/** How long the push service keeps an undelivered push: an hour for urgent, half a day otherwise. */
const TTL_URGENT_SECONDS = 60 * 60;
const TTL_NORMAL_SECONDS = 12 * 60 * 60;
const REQUEST_TIMEOUT_MS = 10_000;

export type PushOutcome = { ok: true } | { ok: false; gone: boolean; error: string };

function vapid() {
  const parsed = vapidSchema.safeParse({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  });
  return parsed.success ? parsed.data : null;
}

/** True when the VAPID keys and subject are set for this server. */
export function isWebPushConfigured(): boolean {
  return vapid() !== null;
}

/**
 * Sends one web push. A 404 or 410 means the subscription is gone and should be dropped. Errors carry
 * only the status code, never the endpoint or keys.
 */
export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
  options: { urgent: boolean },
): Promise<PushOutcome> {
  const keys = vapid();
  if (!keys) return { ok: false, gone: false, error: "web push is not configured" };
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
      {
        vapidDetails: keys,
        TTL: options.urgent ? TTL_URGENT_SECONDS : TTL_NORMAL_SECONDS,
        urgency: options.urgent ? "high" : "normal",
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof webpush.WebPushError) {
      const gone = error.statusCode === 404 || error.statusCode === 410;
      return { ok: false, gone, error: `push service answered ${error.statusCode}` };
    }
    return { ok: false, gone: false, error: "push request failed" };
  }
}
