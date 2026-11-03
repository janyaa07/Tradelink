import "server-only";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { JOB_KINDS, type JobKind } from "./kinds";
import { callSystemRpc } from "./system-rpc";

const INVALID = { ok: false, error: "Check the details and try again.", reason: "INVALID_INPUT" } as const;

const dedupeKeySchema = z.string().trim().min(1).max(200);

const enqueueSchema = z.object({
  kind: z.enum(JOB_KINDS),
  runAt: z.date().refine((date) => !Number.isNaN(date.getTime())),
  dedupeKey: dedupeKeySchema,
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Schedules a job once per dedupe key, for example `chase:{po}:{step}`. Scheduling the same key
 * again while it is pending moves its time and payload; once it has run, the key is spent.
 */
export async function enqueueJob(
  kind: JobKind,
  runAt: Date,
  dedupeKey: string,
  payload: Record<string, unknown> = {},
): Promise<ActionResult<{ id: string }>> {
  const parsed = enqueueSchema.safeParse({ kind, runAt, dedupeKey, payload });
  if (!parsed.success) return INVALID;
  const result = await callSystemRpc<string>("rs_job_enqueue", {
    p_kind: parsed.data.kind,
    p_run_at: parsed.data.runAt.toISOString(),
    p_dedupe_key: parsed.data.dedupeKey,
    p_payload: parsed.data.payload,
  });
  return result.ok ? { ok: true, data: { id: result.data } } : result;
}

/** Cancels the pending job with this dedupe key. A job that already ran or does not exist is left alone. */
export async function cancelJob(dedupeKey: string): Promise<ActionResult> {
  const parsed = dedupeKeySchema.safeParse(dedupeKey);
  if (!parsed.success) return INVALID;
  const result = await callSystemRpc("rs_job_cancel", { p_dedupe_key: parsed.data });
  return result.ok ? { ok: true, data: undefined } : result;
}
