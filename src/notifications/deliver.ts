import "server-only";
import { z } from "zod";
import { enqueueJob } from "@/jobs/enqueue";
import { callSystemRpc } from "@/jobs/system-rpc";
import { logger } from "@/lib/logger";
import { decide, type Decision, type PromptKind } from "./policy";
import { pushSubscriptionSchema, type PushPayload, type PushSubscriptionRecord } from "./subscription";
import { sendWebPush } from "./webpush";

/** One push attempt: a `notification` row with channel 'push'. */
export type PushRow = {
  id: string;
  userId: string;
  shopId: string | null;
  type: string;
  promptKind: PromptKind;
  title: string;
  body: string;
  url: string;
  itemKey: string | null;
  alertId: string | null;
};

export type NotifyContext = {
  dailyLimit: number;
  unpromptedToday: number;
  mutedTypes: string[];
  pushOffTypes: string[];
  ignoredStreak: number;
  sameItemToday: boolean;
  quietHours: { start: string; end: string } | null;
  devices: PushSubscriptionRecord[];
};

export type PushStatus = "SENT" | "FAILED" | "HELD" | "SKIPPED";

const contextSchema = z.object({
  daily_limit: z.number().int().nonnegative(),
  unprompted_today: z.number().int().nonnegative(),
  muted_types: z.array(z.string()),
  push_off_types: z.array(z.string()),
  ignored_streak: z.number().int().nonnegative(),
  same_item_today: z.boolean(),
  quiet_start: z.string().nullable(),
  quiet_end: z.string().nullable(),
  devices: z.array(z.unknown()),
});

/** Loads what the policy needs for one push (rs_notify_context), or null when it cannot. */
export async function loadContext(
  userId: string,
  shopId: string | null,
  type: string,
  itemKey: string | null,
): Promise<NotifyContext | null> {
  const result = await callSystemRpc<unknown>("rs_notify_context", {
    p_user: userId,
    p_shop: shopId,
    p_type: type,
    p_item_key: itemKey,
  });
  if (!result.ok) return null;
  const parsed = contextSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.error("notify_context_malformed", { type });
    return null;
  }
  const raw = parsed.data;
  const devices: PushSubscriptionRecord[] = [];
  for (const device of raw.devices) {
    const subscription = pushSubscriptionSchema.safeParse(device);
    if (subscription.success) devices.push(subscription.data);
  }
  return {
    dailyLimit: raw.daily_limit,
    unpromptedToday: raw.unprompted_today,
    mutedTypes: raw.muted_types,
    pushOffTypes: raw.push_off_types,
    ignoredStreak: raw.ignored_streak,
    sameItemToday: raw.same_item_today,
    quietHours: raw.quiet_start && raw.quiet_end ? { start: raw.quiet_start, end: raw.quiet_end } : null,
    devices,
  };
}

export function decideFor(row: PushRow, context: NotifyContext, now: Date): Decision {
  return decide({
    promptKind: row.promptKind,
    type: row.type,
    now,
    quietHours: context.quietHours,
    unpromptedToday: context.unpromptedToday,
    dailyLimit: context.dailyLimit,
    mutedTypes: context.mutedTypes,
    pushOffTypes: context.pushOffTypes,
    hasPushDevice: context.devices.length > 0,
    ignoredStreak: context.ignoredStreak,
    sameItemToday: context.sameItemToday,
  });
}

/** The dedupe key of the release job for one release time, shared by every push held until then. */
export function releaseJobKey(releaseAt: Date): string {
  return `notify.release:${releaseAt.toISOString()}`;
}

export function payloadFor(row: PushRow): PushPayload {
  return {
    title: row.title,
    body: row.body,
    url: row.url,
    notificationId: row.id,
    tag: `${row.type}:${row.itemKey ?? row.id}`,
  };
}

async function setStatus(id: string, status: PushStatus, error: string | null, releaseAt: Date | null = null): Promise<void> {
  const result = await callSystemRpc("rs_notification_update", {
    p_id: id,
    p_status: status,
    p_error: error,
    p_release_at: releaseAt?.toISOString() ?? null,
  });
  if (!result.ok) logger.error("notify_status_failed", { notificationId: id, status });
}

async function setAlert(alertId: string | null, status: "QUEUED" | "SENT" | "MUTED", releaseAt: Date | null = null): Promise<void> {
  if (!alertId) return;
  const result = await callSystemRpc("rs_alert_update", {
    p_id: alertId,
    p_status: status,
    p_release_at: releaseAt?.toISOString() ?? null,
  });
  if (!result.ok) logger.error("alert_status_failed", { alertId, status });
}

/** Sends to every device; drops subscriptions the push service says are gone. */
async function sendToDevices(row: PushRow, devices: PushSubscriptionRecord[]): Promise<{ sent: boolean; error: string | null }> {
  const payload = payloadFor(row);
  const outcomes = await Promise.all(
    devices.map((device) => sendWebPush(device, payload, { urgent: row.promptKind === "urgent" })),
  );
  const errors: string[] = [];
  await Promise.all(
    outcomes.map(async (outcome, index) => {
      const device = devices[index];
      if (outcome.ok || !device) return;
      errors.push(outcome.error);
      if (outcome.gone) {
        const gone = await callSystemRpc("rs_device_push_gone", { p_endpoint: device.endpoint });
        if (!gone.ok) logger.error("push_gone_failed", { notificationId: row.id });
      }
    }),
  );
  const sent = outcomes.some((outcome) => outcome.ok);
  return { sent, error: sent ? null : [...new Set(errors)].join("; ").slice(0, 300) || "no device accepted the push" };
}

/** Carries out a decision for one push row and records the result on the row and its alert. */
export async function applyDecision(row: PushRow, decision: Decision, devices: PushSubscriptionRecord[]): Promise<PushStatus> {
  if (decision.push === "now") {
    const { sent, error } = await sendToDevices(row, devices);
    await setStatus(row.id, sent ? "SENT" : "FAILED", error);
    if (sent) await setAlert(row.alertId, "SENT");
    logger.info("push_sent", { notificationId: row.id, type: row.type, sent, reason: decision.reason });
    return sent ? "SENT" : "FAILED";
  }

  if (decision.push === "hold") {
    await setStatus(row.id, "HELD", null, decision.releaseAt);
    await setAlert(row.alertId, "QUEUED", decision.releaseAt);
    const job = await enqueueJob("notify.release", decision.releaseAt, releaseJobKey(decision.releaseAt), {
      releaseAt: decision.releaseAt.toISOString(),
    });
    if (!job.ok) logger.error("notify_release_not_scheduled", { notificationId: row.id, reason: job.reason });
    return "HELD";
  }

  await setStatus(row.id, "SKIPPED", decision.reason);
  if (decision.muteType) {
    const muted = await callSystemRpc("rs_notify_mute", { p_user: row.userId, p_type: row.type });
    if (!muted.ok) logger.error("notify_mute_failed", { type: row.type });
  }
  if (decision.reason === "muted" || decision.reason === "ignored" || decision.reason === "push_off") {
    await setAlert(row.alertId, "MUTED");
  }
  return "SKIPPED";
}
