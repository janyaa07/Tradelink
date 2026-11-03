"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { requireRole } from "@/data/session";
import { failed, ok, type FormState } from "./formState";
import { getOrganisation } from "./queries/organisations";
import { getOperatorName } from "./queries/people";

const CHECK_DETAILS = "Check the details and try again.";

const itemKey = z.string().trim().min(1).max(200);

function refreshAdmin(): void {
  revalidatePath("/admin", "layout");
}

/** Another admin got there first: say so and show the current state, rather than "no access". */
function staleOr(result: { error: string; reason?: string }, stale: string): FormState {
  if (result.reason !== "INVALID_TRANSITION") return failed(result.error);
  refreshAdmin();
  return failed(stale);
}

const assignSchema = z.object({
  item: itemKey,
  user: z.union([z.literal(""), z.uuid()]),
});

/** Saves "Assigned to" for one attention item (ADM-04). An empty user clears it. */
export async function assignAttentionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = assignSchema.safeParse({ item: formData.get("item"), user: formData.get("user") });
  if (!parsed.success) return failed(CHECK_DETAILS);
  const userId = parsed.data.user || null;

  const result = await callRpc("assign_attention", { p_item: parsed.data.item, p_user: userId });
  if (!result.ok) return failed(result.error);
  refreshAdmin();
  if (!userId) return ok("Item unassigned.");
  const name = await getOperatorName(userId);
  return ok(name ? `Assigned to ${name}.` : "Assignment saved.");
}

/** Hides a system or blocked-action item until its cause occurs again (ADM-05). */
export async function markHandledAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = itemKey.safeParse(formData.get("item"));
  if (!parsed.success) return failed(CHECK_DETAILS);

  const result = await callRpc("mark_attention_handled", { p_item: parsed.data });
  if (!result.ok) return failed(result.error);
  refreshAdmin();
  return ok("Marked as handled.");
}

const disputeSchema = z.object({
  issue: z.uuid(),
  outcome: z.enum(["credit", "close"]),
  key: z.uuid(),
});

/** "Credit buyer" or "Close, no credit" on a disputed problem (ADM-07). */
export async function resolveDisputeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = disputeSchema.safeParse({
    issue: formData.get("issue"),
    outcome: formData.get("outcome"),
    key: formData.get("key"),
  });
  if (!parsed.success) return failed(CHECK_DETAILS);

  const result = await callRpc("resolve_dispute", {
    p_issue: parsed.data.issue,
    p_outcome: parsed.data.outcome,
    p_key: parsed.data.key,
  });
  if (!result.ok) return staleOr(result, "This dispute has already been resolved.");
  refreshAdmin();
  return ok("Dispute resolved.");
}

const supplierStatusSchema = z.object({
  org: z.uuid(),
  status: z.enum(["active", "suspended"]),
  key: z.uuid(),
});

/** Suspends or reactivates a supplier after the confirm step (ADM-12, SUP-22). */
export async function setSupplierStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = supplierStatusSchema.safeParse({
    org: formData.get("org"),
    status: formData.get("status"),
    key: formData.get("key"),
  });
  if (!parsed.success) return failed(CHECK_DETAILS);

  const result = await callRpc("set_supplier_status", {
    p_org: parsed.data.org,
    p_status: parsed.data.status,
    p_key: parsed.data.key,
  });
  if (!result.ok) return staleOr(result, "This supplier's status has already changed.");
  refreshAdmin();
  const supplier = await getOrganisation(parsed.data.org, "supplier");
  const name = supplier?.name ?? "Supplier";
  return ok(parsed.data.status === "suspended" ? `${name}: suspended.` : `${name}: active.`);
}

/** Records that the signed-in admin is active, for operator presence (ADM-16). */
export async function touchLastSeenAction(): Promise<void> {
  await requireRole("admin");
  await callRpc("touch_last_seen", {});
}
