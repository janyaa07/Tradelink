import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AUDIT_PAGE_SIZE, type AuditQuery } from "../params";

const rowSchema = z.object({
  id: z.number(),
  at: z.string(),
  actor_name: z.string().nullable(),
  actor_org_name: z.string().nullable(),
  actor_role: z.string().nullable(),
  action: z.string(),
  outcome: z.enum(["allowed", "denied"]),
});

export type AuditEntry = {
  id: number;
  at: string;
  who: string;
  orgName: string;
  role: string;
  action: string;
  outcome: "allowed" | "denied";
};

const ROLE_NAMES: Record<string, string> = { admin: "Admin", buyer: "Buyer", supplier: "Supplier" };

function toEntry(row: z.infer<typeof rowSchema>): AuditEntry {
  return {
    id: row.id,
    at: row.at,
    who: row.actor_name ?? "Unknown user",
    orgName: row.actor_org_name ?? "No organisation",
    role: ROLE_NAMES[row.actor_role ?? ""] ?? "No role",
    action: row.action,
    outcome: row.outcome,
  };
}

const RANGE_NOT_SATISFIABLE = "PGRST103";
const SELECT = "id, at, actor_name, actor_org_name, actor_role, action, outcome";

/** One page of the audit log, newest first (ADM-18). The org filter matches the actor or a related organisation. */
export async function getAuditPage(query: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const from = (query.page - 1) * AUDIT_PAGE_SIZE;
  let request = supabase
    .from("audit_log")
    .select(SELECT, { count: "exact" })
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);
  if (query.orgId) request = request.or(`actor_org_id.eq.${query.orgId},related_org_ids.cs.{${query.orgId}}`);
  if (query.outcome !== "all") request = request.eq("outcome", query.outcome);
  const { data, error, count } = await request;
  // A page past the end is not an error for the reader: show it as empty.
  if (error?.code === RANGE_NOT_SATISFIABLE) return { entries: [], total: 0 };
  if (error) throw new Error(`Could not load the audit log: ${error.message}`);
  const entries = z.array(rowSchema).parse(data).map(toEntry);
  return { entries, total: count ?? entries.length };
}

export async function getRecentAudit(limit: number): Promise<AuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(SELECT)
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load recent activity: ${error.message}`);
  return z.array(rowSchema).parse(data).map(toEntry);
}
