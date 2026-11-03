import "server-only";
import { createSupabaseAdminClient, hasAdminClient } from "@/data/supabase/admin";
import { parseDbError, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** The reason on every result when SUPABASE_SECRET_KEY is missing, so jobs and notifications cannot run. */
export const NOT_CONFIGURED_REASON = "NOT_CONFIGURED";
const NOT_CONFIGURED_COPY = "Background jobs are not set up on this server.";

/**
 * Calls one server-only database function (app.rs_require_system()) with the secret key and maps its
 * typed error like callRpc does. It never throws: a missing key comes back as reason NOT_CONFIGURED.
 */
export async function callSystemRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  if (!hasAdminClient()) {
    logger.error("system_not_configured", { rpc: name });
    return { ok: false, error: NOT_CONFIGURED_COPY, reason: NOT_CONFIGURED_REASON };
  }
  try {
    const { data, error } = await createSupabaseAdminClient().rpc(name, args);
    if (!error) return { ok: true, data: data as T };
    const parsed = parseDbError(error.message);
    logger.error("system_rpc_failed", { rpc: name, code: parsed.code, reason: parsed.reason, pgCode: error.code });
    return { ok: false, error: parsed.message, reason: parsed.reason, detail: parsed.detail };
  } catch (error) {
    logger.error("system_rpc_threw", { rpc: name, error: errorText(error) });
    return { ok: false, error: "Something went wrong. Try again.", reason: "UNEXPECTED" };
  }
}

/** A short, log-safe description of a thrown value. */
export function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "unknown error";
  return text.slice(0, 300);
}
