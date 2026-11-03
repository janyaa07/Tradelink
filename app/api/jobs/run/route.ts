import { handleJobsRun } from "@/jobs/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The job runner tick: pg_cron posts here every minute (docs/PLAN.md section 2.2). */
export function POST() {
  return handleJobsRun();
}

/** The same run, for a manual check from a browser. */
export function GET() {
  return handleJobsRun();
}
