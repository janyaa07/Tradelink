import "server-only";
import { notifyReleaseJob } from "@/notifications/release";
import type { DefinedJob, JobContext, JobResult } from "./define";
import { isJobKind, type JobKind } from "./kinds";
import { systemPingJob } from "./ping";

/**
 * Job kind to handler. Each handler is made with defineJob({ schema, run }): the runner checks the
 * payload with `schema`, then calls `run(ctx, payload)`, which returns { ok } or { ok: false, error }.
 *
 * The pattern every handler follows (docs/AI_DESIGN.md section 6, EC28):
 * 1. Load the subject (PO, order, notification) fresh from the database. Never trust the payload
 *    beyond ids: it was written when the job was scheduled and may be stale.
 * 2. Re-check the subject's state. If it no longer needs this job (the PO was answered or cancelled,
 *    the card was acted on, the notification was opened), finish with { ok: true } and do nothing.
 * 3. Act only through database functions, with an idempotency key derived from the job (for example
 *    the job id), because a job can run more than once after a crash or a timeout.
 * 4. Watch ctx.signal in loops and stop when it aborts; the runner has already recorded a timeout.
 * 5. Return { ok: false, error } for a failure worth retrying; rs_job_finish retries with backoff up
 *    to 5 attempts. Keep `error` short and free of payload data or personal details.
 */
const HANDLERS: Record<JobKind, DefinedJob> = {
  "system.ping": systemPingJob,
  "notify.release": notifyReleaseJob,
};

/** Runs one job by kind. An unknown kind or an invalid payload fails without throwing. */
export async function runJob(kind: string, ctx: JobContext, payload: unknown): Promise<JobResult> {
  if (!isJobKind(kind)) return { ok: false, error: "unknown job kind" };
  return HANDLERS[kind].execute(ctx, payload);
}
