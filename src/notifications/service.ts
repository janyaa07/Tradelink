import "server-only";
import { z } from "zod";
import { callSystemRpc } from "@/jobs/system-rpc";
import type { ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { applyDecision, decideFor, loadContext, type PushRow, type PushStatus } from "./deliver";
import type { DecisionReason } from "./policy";
import { BODY_MAX, TITLE_MAX } from "./templates";

const DEFAULT_URL = "/r";

const notifySchema = z.object({
  userId: z.uuid(),
  shopId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  type: z.string().regex(/^[a-z][a-z0-9_]{1,60}$/),
  promptKind: z.enum(["prompted", "unprompted", "urgent"]),
  cardId: z.uuid().optional(),
  title: z.string().trim().min(1).max(TITLE_MAX),
  body: z.string().trim().min(1).max(BODY_MAX),
  /** A path in this app, so a push can never open another site. */
  url: z.string().max(500).regex(/^\/(?!\/)/).optional(),
  itemKey: z.string().trim().min(1).max(120).optional(),
});

export type NotifyInput = z.input<typeof notifySchema>;

export type NotifyOutcome = {
  notificationId: string;
  pushId: string | null;
  alertId: string | null;
  push: "now" | "hold" | "skip";
  /** Why, or "unavailable" when the push could not be decided (the in-app row is still written). */
  reason: DecisionReason | "unavailable";
  status: PushStatus | null;
};

/**
 * The one entry point for telling someone something (docs/AI_DESIGN.md section 6). The in-app notification
 * is always written; for unprompted and urgent messages about a shop, an alert goes to its Alerts
 * inbox (merged per item per day). The push is then sent now, held until quiet hours end (with a
 * notify.release job), or skipped, as policy.ts decides. Writes only through server-only functions.
 */
export async function notify(input: NotifyInput, now: Date = new Date()): Promise<ActionResult<NotifyOutcome>> {
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the details and try again.", reason: "INVALID_INPUT" };
  const message = parsed.data;
  const url = message.url ?? DEFAULT_URL;
  const shared = {
    user_id: message.userId,
    shop_id: message.shopId ?? null,
    supplier_id: message.supplierId ?? null,
    type: message.type,
    prompt_kind: message.promptKind,
    card_id: message.cardId ?? null,
    title: message.title,
    body: message.body,
    url,
    item_key: message.itemKey ?? null,
  };

  const inApp = await callSystemRpc<string>("rs_notification_put", { p_notification: { ...shared, channel: "in_app", status: "SENT" } });
  if (!inApp.ok) return inApp;
  const outcome: NotifyOutcome = {
    notificationId: inApp.data,
    pushId: null,
    alertId: null,
    push: "skip",
    reason: "unavailable",
    status: null,
  };

  if (message.shopId && message.promptKind !== "prompted") {
    const alert = await callSystemRpc<{ id: string; merged: boolean }>("rs_alert_put", {
      p_alert: {
        shop_id: message.shopId,
        type: message.type,
        priority: message.promptKind === "urgent" ? "urgent" : "normal",
        item_key: message.itemKey ?? null,
        card_id: message.cardId ?? null,
      },
    });
    if (alert.ok) outcome.alertId = alert.data.id;
  }

  const context = await loadContext(message.userId, message.shopId ?? null, message.type, message.itemKey ?? null);
  if (!context) return { ok: true, data: outcome };

  const push = await callSystemRpc<string>("rs_notification_put", {
    p_notification: { ...shared, channel: "push", status: "PENDING", alert_id: outcome.alertId },
  });
  if (!push.ok) return { ok: true, data: outcome };

  const row: PushRow = {
    id: push.data,
    userId: message.userId,
    shopId: message.shopId ?? null,
    type: message.type,
    promptKind: message.promptKind,
    title: message.title,
    body: message.body,
    url,
    itemKey: message.itemKey ?? null,
    alertId: outcome.alertId,
  };
  const decision = decideFor(row, context, now);
  const status = await applyDecision(row, decision, context.devices);
  logger.info("notified", { type: message.type, promptKind: message.promptKind, push: decision.push, reason: decision.reason });
  return { ok: true, data: { ...outcome, pushId: row.id, push: decision.push, reason: decision.reason, status } };
}
