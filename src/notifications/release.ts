import "server-only";
import { z } from "zod";
import { defineJob } from "@/jobs/define";
import { callSystemRpc } from "@/jobs/system-rpc";
import { logger } from "@/lib/logger";
import { applyDecision, decideFor, loadContext, type PushRow } from "./deliver";

/** Card states after which a held push has nothing left to ask. */
const CLOSED_CARD_STATES = new Set(["confirmed", "accepted", "partial", "rejected", "done", "undone", "superseded", "expired"]);
const CLAIM_LIMIT = 50;

const heldRowSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  shop_id: z.string().nullable(),
  type: z.string(),
  prompt_kind: z.enum(["prompted", "unprompted", "urgent"]),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  item_key: z.string().nullable(),
  alert_id: z.string().nullable(),
  card_state: z.string().nullable(),
  opened_at: z.string().nullable(),
});
type HeldRow = z.infer<typeof heldRowSchema>;

async function skip(id: string, reason: string): Promise<void> {
  const result = await callSystemRpc("rs_notification_update", { p_id: id, p_status: "SKIPPED", p_error: reason });
  if (!result.ok) logger.error("notify_status_failed", { notificationId: id, status: "SKIPPED" });
}

/**
 * Re-checks one held push before sending it: skipped if it was opened or its card was acted on or
 * closed, then decided again with today's counts (the daily limit may now be reached). A row whose
 * context cannot be loaded stays claimed and is picked up again after 10 minutes.
 */
async function releaseOne(row: HeldRow, now: Date): Promise<void> {
  if (row.opened_at) return skip(row.id, "opened");
  if (row.card_state && CLOSED_CARD_STATES.has(row.card_state)) return skip(row.id, "card_closed");

  const context = await loadContext(row.user_id, row.shop_id, row.type, row.item_key);
  if (!context) return;
  const push: PushRow = {
    id: row.id,
    userId: row.user_id,
    shopId: row.shop_id,
    type: row.type,
    promptKind: row.prompt_kind,
    title: row.title,
    body: row.body,
    url: row.url ?? "/r",
    itemKey: row.item_key,
    alertId: row.alert_id,
  };
  await applyDecision(push, decideFor(push, context, now), context.devices);
}

/**
 * Sends every push held for quiet hours whose release time has passed, not only those for this job's
 * time, so a release job that failed to schedule is covered by the next one.
 */
export const notifyReleaseJob = defineJob({
  schema: z.object({ releaseAt: z.iso.datetime().optional() }),
  run: async (ctx) => {
    for (;;) {
      if (ctx.signal.aborted) return { ok: false, error: "timed out" };
      const claimed = await callSystemRpc<unknown>("rs_notification_claim_held", { p_limit: CLAIM_LIMIT });
      if (!claimed.ok) return { ok: false, error: claimed.reason ?? "claim failed" };
      const rows = z.array(z.unknown()).safeParse(claimed.data);
      if (!rows.success) return { ok: false, error: "malformed held notifications" };

      for (const raw of rows.data) {
        if (ctx.signal.aborted) return { ok: false, error: "timed out" };
        const row = heldRowSchema.safeParse(raw);
        if (row.success) await releaseOne(row.data, ctx.now);
        else logger.error("notify_held_malformed", {});
      }
      if (rows.data.length < CLAIM_LIMIT) return { ok: true };
    }
  },
});
