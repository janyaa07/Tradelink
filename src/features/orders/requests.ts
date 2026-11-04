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

/** A date change the other side asked for that waits for the signed-in organisation's answer. */
export type OpenDateRequest = {
  id: string;
  orderId: string;
  orderNumber: number;
  fromName: string;
  rest: boolean;
  proposedDate: string;
  note: string | null;
};

const openSchema = z.object({
  id: z.uuid(),
  part: z.enum(["first", "rest"]).nullable(),
  proposed_date: z.string(),
  body: z.string().nullable(),
  from: z.object({ name: z.string() }).nullable(),
  parent: z.object({ id: z.uuid(), number: z.number() }).nullable(),
});

/** Every date change waiting for this organisation's answer, newest first. */
export async function getOpenDateRequests(orgId: string): Promise<OpenDateRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_requests")
    .select("id, part, proposed_date, body, from:organisations!order_requests_from_org_id_fkey(name), parent:orders(id, number)")
    .eq("kind", "date_change")
    .eq("status", "open")
    .neq("from_org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load date changes: ${error.message}`);
  return z
    .array(openSchema)
    .parse(data)
    .flatMap((row) =>
      row.parent
        ? [
            {
              id: row.id,
              orderId: row.parent.id,
              orderNumber: row.parent.number,
              fromName: row.from?.name ?? "The other business",
              rest: row.part === "rest",
              proposedDate: row.proposed_date,
              note: row.body,
            },
          ]
        : [],
    );
}

/** The other side's latest message on an order, when nobody here has written since. */
export type UnansweredMessage = { orderId: string; orderNumber: number; fromName: string; body: string; createdAt: string };

const messageRowSchema = z.object({
  from_org_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
  from: z.object({ name: z.string() }).nullable(),
  parent: z.object({ id: z.uuid(), number: z.number() }).nullable(),
});

const MESSAGES_SCANNED = 60;

/** Orders whose newest message is from the other side, newest first: each waits for a reply. */
export async function getUnansweredMessages(orgId: string): Promise<UnansweredMessage[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_requests")
    .select("from_org_id, body, created_at, from:organisations!order_requests_from_org_id_fkey(name), parent:orders(id, number)")
    .eq("kind", "message")
    .order("created_at", { ascending: false })
    .limit(MESSAGES_SCANNED);
  if (error) throw new Error(`Could not load messages: ${error.message}`);
  const latest = new Map<string, z.infer<typeof messageRowSchema>>();
  for (const row of z.array(messageRowSchema).parse(data)) {
    if (row.parent && !latest.has(row.parent.id)) latest.set(row.parent.id, row);
  }
  return [...latest.values()].flatMap((row) =>
    row.parent && row.from_org_id !== orgId
      ? [
          {
            orderId: row.parent.id,
            orderNumber: row.parent.number,
            fromName: row.from?.name ?? "The other business",
            body: row.body,
            createdAt: row.created_at,
          },
        ]
      : [],
  );
}
