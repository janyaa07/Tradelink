import "server-only";
import { z } from "zod";
import { formatMoney, toCents } from "@/domain/money";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { orderNumber } from "@/ui/format";
import { isDispute, sortAttention, sourceOf, type AttentionItem } from "../attention";
import { issueTypeLabel } from "../labels";
import { isUuid } from "../params";
import { money, selectAll, selectRows } from "./fetch";

const rowSchema = z.object({
  item_key: z.string(),
  priority: z.enum(["high", "medium"]),
  type: z.string(),
  title: z.string(),
  detail: z.string(),
  org_id: z.uuid().nullable(),
  created_at: z.string(),
  assigned_user_id: z.uuid().nullable(),
});

/** Live attention items (admins only, `v_attention`), high first then oldest first. */
export async function getAttentionItems(): Promise<AttentionItem[]> {
  const supabase = await createSupabaseServerClient();
  const rows = await selectAll(rowSchema, "attention items", (from, to) =>
    supabase.from("v_attention").select("*").order("created_at").range(from, to),
  );
  const items = rows.map((row) => ({
    key: row.item_key,
    priority: row.priority,
    type: row.type,
    title: row.title,
    detail: row.detail,
    orgId: row.org_id,
    createdAt: row.created_at,
    assignedUserId: row.assigned_user_id,
  }));
  return sortAttention(await withDisputeDetails(items));
}

export async function countAttention(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase.from("v_attention").select("item_key", { count: "exact", head: true });
  if (error) throw new Error(`Could not count attention items: ${error.message}`);
  return count ?? 0;
}

const disputeSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  amount: money,
  note: z.string().nullable(),
  order: z.object({ number: z.number() }),
  buyer: z.object({ name: z.string() }),
  supplier: z.object({ name: z.string() }),
});

/**
 * Disputes read as "Dispute on {ORD}" with both businesses, type, amount and note (ADM-07),
 * which `v_attention` does not carry, so they are filled in from the issues.
 */
async function withDisputeDetails(items: AttentionItem[]): Promise<AttentionItem[]> {
  const issueIds = items
    .filter(isDispute)
    .map((item) => sourceOf(item.key).id)
    .filter(isUuid);
  if (issueIds.length === 0) return items;

  const supabase = await createSupabaseServerClient();
  const disputes = await selectRows(
    disputeSchema,
    "disputes",
    supabase
      .from("issues")
      .select(
        `id, type, amount, note, order:orders(number),
        buyer:organisations!issues_buyer_org_id_fkey(name),
        supplier:organisations!issues_supplier_org_id_fkey(name)`,
      )
      .in("id", issueIds),
  );
  const byId = new Map(disputes.map((dispute) => [dispute.id, dispute]));

  return items.map((item) => {
    const dispute = isDispute(item) ? byId.get(sourceOf(item.key).id) : undefined;
    if (!dispute) return item;
    const note = dispute.note?.trim() ? ` ${dispute.note.trim()}` : "";
    return {
      ...item,
      title: `Dispute on ${orderNumber(dispute.order.number)}`,
      detail: `${dispute.buyer.name} and ${dispute.supplier.name}: ${issueTypeLabel(dispute.type)}, ${formatMoney(toCents(dispute.amount))}.${note}`,
    };
  });
}
