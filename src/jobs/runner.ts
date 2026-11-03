import "server-only";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { JobResult } from "./define";
import { runJob } from "./registry";
import { callSystemRpc, errorText } from "./system-rpc";

export type RunSummary = { claimed: number; done: number; failed: number };

export type RunOptions = {
  /** Most jobs to run in one call. */
  maxJobs?: number;
  /** Overall time budget for the call, in milliseconds. */
  budgetMs?: number;
  /** Time one job may take before it is recorded as failed, in milliseconds. */
  jobTimeoutMs?: number;
  clock?: () => number;
};

const MAX_BATCH = 5;

const claimedJobSchema = z.object({
  id: z.string().min(1),
  kind: z.string(),
  payload: z.unknown(),
  attempts: z.number().int().nonnegative(),
});
type ClaimedJob = z.infer<typeof claimedJobSchema>;

/**
 * Claims due jobs in small batches and runs each with a timeout, until `maxJobs` have run, nothing is
 * due, or the budget is spent. A batch is only as large as the remaining budget can finish, so no job
 * is left claimed and unrun. It never throws: every failure is recorded with rs_job_finish and logged.
 */
export async function runDueJobs(options: RunOptions = {}): Promise<RunSummary> {
  const { maxJobs = 25, budgetMs = 50_000, jobTimeoutMs = 15_000, clock = Date.now } = options;
  const started = clock();
  const summary: RunSummary = { claimed: 0, done: 0, failed: 0 };

  while (summary.claimed < maxJobs) {
    const remaining = budgetMs - (clock() - started);
    const batch = Math.min(MAX_BATCH, maxJobs - summary.claimed, Math.floor(remaining / jobTimeoutMs));
    if (batch < 1) break;

    const jobs = await claimJobs(batch);
    summary.claimed += jobs.length;
    for (const job of jobs) {
      if (await runOne(job, jobTimeoutMs, clock)) summary.done += 1;
      else summary.failed += 1;
    }
    if (jobs.length < batch) break;
  }

  logger.info("jobs_run", { ...summary, ms: clock() - started });
  return summary;
}

async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const result = await callSystemRpc<unknown>("rs_job_claim", { p_limit: limit });
  if (!result.ok) return [];
  const rows = z.array(z.unknown()).safeParse(result.data);
  if (!rows.success) return [];
  const jobs: ClaimedJob[] = [];
  for (const row of rows.data) {
    const job = claimedJobSchema.safeParse(row);
    if (job.success) jobs.push(job.data);
    else logger.error("job_claim_malformed", {});
  }
  return jobs;
}

async function runOne(job: ClaimedJob, timeoutMs: number, clock: () => number): Promise<boolean> {
  const started = clock();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<JobResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, error: "timed out" });
    }, timeoutMs);
  });

  let result: JobResult;
  try {
    const ctx = { jobId: job.id, attempt: job.attempts, now: new Date(clock()), signal: controller.signal };
    result = await Promise.race([runJob(job.kind, ctx, job.payload), timeout]);
  } catch (error) {
    result = { ok: false, error: errorText(error) };
  } finally {
    clearTimeout(timer);
  }

  const finished = await callSystemRpc("rs_job_finish", {
    p_id: job.id,
    p_ok: result.ok,
    p_error: result.ok ? null : result.error.slice(0, 300),
  });
  if (!finished.ok) logger.error("job_finish_failed", { jobId: job.id, kind: job.kind });

  const fields = { jobId: job.id, kind: job.kind, attempt: job.attempts, ms: clock() - started };
  if (result.ok) logger.info("job_done", fields);
  else logger.warn("job_failed", { ...fields, error: result.error.slice(0, 300) });
  return result.ok;
}
