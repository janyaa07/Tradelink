import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";

/** A delivery date change one side asked for, or a message, on one order. */
export type OrderRequest = {
  id: string;
  kind: "date_change" | "message";
  /** Which delivery a date change is for: the first (or only) one, or the rest. */
  part: "first" | "rest" | null;
  proposedDate: string | null;
  body: string | null;
  status: "open" | "accepted" | "declined" | "withdrawn" | "sent";
  answer: string | null;
  fromOrgId: string;
  fromName: string;
  createdAt: string;
  answeredAt: string | null;
};

const requestSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["date_change", "message"]),
  part: z.enum(["first", "rest"]).nullable(),
  proposed_date: z.string().nullable(),
  body: z.string().nullable(),
  status: z.enum(["open", "accepted", "declined", "withdrawn", "sent"]),
  answer: z.string().nullable(),
  from_org_id: z.uuid(),
  from: z.object({ name: z.string() }).nullable(),
  created_at: z.string(),
  answered_at: z.string().nullable(),
});

/** Date changes and messages on an order, oldest first. Read through the order's own RLS. */
export async function getOrderRequests(orderId: string): Promise<OrderRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_requests")
    .select(
      "id, kind, part, proposed_date, body, status, answer, from_org_id, from:organisations!order_requests_from_org_id_fkey(name), created_at, answered_at",
    )
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw new Error(`Could not load order messages: ${error.message}`);
  return z
    .array(requestSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      part: row.part,
      proposedDate: row.proposed_date,
      body: row.body,
      status: row.status,
      answer: row.answer,
      fromOrgId: row.from_org_id,
      fromName: row.from?.name ?? "The other business",
      createdAt: row.created_at,
      answeredAt: row.answered_at,
    }));
}
