import { z } from "zod";

const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

/** A browser's PushSubscription.toJSON(), as stored in device.push_subscription. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(200).regex(BASE64URL),
    auth: z.string().min(8).max(100).regex(BASE64URL),
  }),
});

export type PushSubscriptionRecord = z.infer<typeof pushSubscriptionSchema>;

/**
 * What the service worker (public/sw.js) receives in a push event. `tag` is the type plus the item,
 * so a newer push about the same thing replaces the older one on the lock screen.
 */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  notificationId: string;
  tag: string;
};
