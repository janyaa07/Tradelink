import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { callSystemRpc } from "@/jobs/system-rpc";
import type { ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const EVENT_NAME = /^[a-z][a-z0-9_.]{1,60}$/;
const MAX_PROPS_CHARS = 4000;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonSchema), z.record(z.string(), jsonSchema)]),
);

const eventSchema = z.object({
  name: z.string().regex(EVENT_NAME),
  shopId: z.uuid().optional(),
  props: z
    .record(z.string(), jsonSchema)
    .refine((props) => JSON.stringify(props).length <= MAX_PROPS_CHARS)
    .optional(),
  clientEventId: z.string().min(1).max(100).optional(),
  occurredAt: z.date().optional(),
});

export type EventOptions = {
  shopId?: string;
  props?: Record<string, Json>;
  /** Set by the client for offline events, so a replayed event is recorded once. */
  clientEventId?: string;
  occurredAt?: Date;
  /** "user" (default) records it as the signed-in person; "system" with the secret key, for jobs. */
  as?: "user" | "system";
};

/**
 * Appends one row to the event log (docs/PLAN.md section 3), the metrics source for the scorecard.
 * It never throws, so a failed event never breaks the action that logged it.
 */
export async function logEvent(name: string, options: EventOptions = {}): Promise<ActionResult> {
  const parsed = eventSchema.safeParse({ name, ...options });
  if (!parsed.success) {
    logger.warn("event_invalid", { name: name.slice(0, 60) });
    return { ok: false, error: "Check the details and try again.", reason: "INVALID_INPUT" };
  }
  const args = {
    p_name: parsed.data.name,
    p_shop: parsed.data.shopId ?? null,
    p_props: parsed.data.props ?? {},
    p_client_event_id: parsed.data.clientEventId ?? null,
    p_occurred_at: parsed.data.occurredAt?.toISOString() ?? null,
  };
  try {
    const result = options.as === "system" ? await callSystemRpc("rs_log_event", args) : await callRpc("rs_log_event", args);
    if (!result.ok) logger.warn("event_not_logged", { name: parsed.data.name, reason: result.reason });
    return result.ok ? { ok: true, data: undefined } : result;
  } catch (error) {
    unstable_rethrow(error);
    logger.error("event_failed", { name: parsed.data.name, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { ok: false, error: "Something went wrong. Try again.", reason: "UNEXPECTED" };
  }
}
