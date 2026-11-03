import "server-only";
import { NextResponse } from "next/server";
import { hasAdminClient } from "@/data/supabase/admin";
import { logger } from "@/lib/logger";
import { runDueJobs } from "./runner";

/** Set while this instance is running jobs, so an overlapping tick returns at once. */
let running = false;

/**
 * Handles GET and POST /api/jobs/run. It is public because it only runs jobs that are already due,
 * and it returns counts only: never payloads, errors or settings.
 */
export async function handleJobsRun(): Promise<NextResponse> {
  if (!hasAdminClient()) {
    logger.error("jobs_not_configured", {});
    return NextResponse.json({ error: "Background jobs are not set up on this server." }, { status: 503 });
  }
  if (running) return NextResponse.json({ claimed: 0, done: 0, failed: 0, busy: true }, { status: 202 });

  running = true;
  try {
    const { claimed, done, failed } = await runDueJobs({ maxJobs: 25, budgetMs: 50_000 });
    return NextResponse.json({ claimed, done, failed });
  } finally {
    running = false;
  }
}
