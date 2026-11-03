import "server-only";
import { parseDbError, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "./supabase/server";

type Args = Record<string, unknown>;

/**
 * Calls one database write function as the signed-in user (ADR 0004) and maps its
 * typed error to user-facing copy. Denied attempts are written to the audit log.
 */
export async function callRpc<T = unknown>(name: string, args: Args): Promise<ActionResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);
  if (!error) return { ok: true, data: data as T };

  const parsed = parseDbError(error.message);
  if (parsed.code === "TL500") logger.error("rpc_failed", { rpc: name, pgCode: error.code });
  if (parsed.code === "TL403" || parsed.reason === "INVALID_TRANSITION") {
    await supabase.rpc("log_denied", { p_action: `Blocked from ${name.replaceAll("_", " ")}` });
  }
  return { ok: false, error: parsed.message, reason: parsed.reason, detail: parsed.detail };
}
