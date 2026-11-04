import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { buildTodos, type DateRequestInput, type PartialInput, type PriceChangeInput, type ReplyInput, type Todo } from "@/domain/todos";
import { getUnansweredMessages } from "@/features/orders/requests";
import { formatDate, orderNumber } from "@/ui/format";
import { getBuyerSettings, getUsualItems } from "./queries";

const money = z.union([z.string(), z.number()]).transform((value) => Number(value).toFixed(2));
const named = z.object({ name: z.string() }).nullable();

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

const priceChangeSchema = z.object({
  id: z.uuid(),
  old_price: money,
  new_price: money,
  product: z.object({ name: z.string(), supplier: named }).nullable(),
});

/** Price changes on usual items that nobody in the business has acknowledged (BUY-02). */
async function getPriceChanges(orgId: string, productIds: string[]): Promise<PriceChangeInput[]> {
  if (productIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const [changes, acks] = await Promise.all([
    supabase
      .from("price_changes")
      .select("id, old_price, new_price, product:products(name, supplier:organisations!products_supplier_org_id_fkey(name))")
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("price_change_acks").select("price_change_id").eq("buyer_org_id", orgId),
  ]);
  if (changes.error) fail("price changes", changes.error.message);
  if (acks.error) fail("price changes", acks.error.message);
  const acked = new Set(
    z
      .array(z.object({ price_change_id: z.uuid() }))
      .parse(acks.data)
      .map((row) => row.price_change_id),
  );
  return z
    .array(priceChangeSchema)
    .parse(changes.data)
    .filter((row) => !acked.has(row.id) && row.product !== null)
    .map((row) => ({
      id: row.id,
      productName: row.product?.name ?? "",
      supplierName: row.product?.supplier?.name ?? "your supplier",
      oldPrice: row.old_price,
      newPrice: row.new_price,
    }));
}

const partialSchema = z.object({
  id: z.uuid(),
  asked: z.number(),
  sent: z.number(),
  product: named,
  parent: z.object({ id: z.uuid(), number: z.number(), supplier: named }).nullable(),
});

/** Part acceptances the buyer has not acted on (BUY-03). RLS limits them to the buyer's orders. */
async function getPartials(): Promise<PartialInput[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("partial_fulfilments")
    .select("id, asked, sent, product:products(name), parent:orders(id, number, supplier:organisations!orders_supplier_org_id_fkey(name))")
    .eq("status", "new")
    .order("created_at", { ascending: false });
  if (error) fail("part deliveries", error.message);
  return z
    .array(partialSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      productName: row.product?.name ?? "An item",
      supplierName: row.parent?.supplier?.name ?? "Your supplier",
      orderRef: row.parent ? orderNumber(row.parent.number) : "your order",
      orderId: row.parent?.id ?? null,
      asked: row.asked,
      sent: row.sent,
    }));
}

const replySchema = z.object({
  id: z.uuid(),
  status: z.string(),
  amount: money,
  supplier: named,
  parent: z.object({ id: z.uuid(), number: z.number() }).nullable(),
});

/** Answered problems the buyer has not seen yet (BUY-04). */
async function getReplies(orgId: string): Promise<ReplyInput[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("issues")
    .select("id, status, amount, supplier:organisations!issues_supplier_org_id_fkey(name), parent:orders(id, number)")
    .eq("buyer_org_id", orgId)
    .eq("buyer_seen", false)
    .not("status", "in", "(open,credit_received)")
    .order("answered_at", { ascending: false });
  if (error) fail("replies", error.message);
  return z
    .array(replySchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      status: row.status,
      amount: row.amount,
      supplierName: row.supplier?.name ?? "Your supplier",
      orderRef: row.parent ? orderNumber(row.parent.number) : "your order",
      orderId: row.parent?.id ?? null,
    }));
}

const dateRequestSchema = z.object({
  id: z.uuid(),
  part: z.enum(["first", "rest"]).nullable(),
  proposed_date: z.string(),
  body: z.string().nullable(),
  parent: z
    .object({
      id: z.uuid(),
      number: z.number(),
      requested_delivery_date: z.string().nullable(),
      confirmed_delivery_date: z.string().nullable(),
      later_delivery_date: z.string().nullable(),
      supplier: named,
    })
    .nullable(),
});

/** Delivery date changes a supplier asked for that wait for the buyer's answer. */
async function getDateRequests(orgId: string): Promise<DateRequestInput[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_requests")
    .select(
      "id, part, proposed_date, body, parent:orders(id, number, requested_delivery_date, confirmed_delivery_date, later_delivery_date, supplier:organisations!orders_supplier_org_id_fkey(name))",
    )
    .eq("kind", "date_change")
    .eq("status", "open")
    .neq("from_org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) fail("date changes", error.message);
  return z
    .array(dateRequestSchema)
    .parse(data)
    .flatMap((row) => {
      if (!row.parent) return [];
      const rest = row.part === "rest";
      const from = rest ? row.parent.later_delivery_date : (row.parent.confirmed_delivery_date ?? row.parent.requested_delivery_date);
      return [
        {
          id: row.id,
          orderId: row.parent.id,
          orderRef: orderNumber(row.parent.number),
          supplierName: row.parent.supplier?.name ?? "Your supplier",
          rest,
          from: from ? formatDate(from) : null,
          to: formatDate(row.proposed_date),
          note: row.body,
        },
      ];
    });
}

/** The buyer's To do list, most urgent first. Cached per request. */
export const getTodos = cache(async (orgId: string): Promise<Todo[]> => {
  const [settings, usuals] = await Promise.all([getBuyerSettings(orgId), getUsualItems(orgId)]);
  const [priceChanges, partials, replies, dateRequests, unanswered] = await Promise.all([
    settings.priceAlerts
      ? getPriceChanges(
          orgId,
          usuals.map((usual) => usual.productId),
        )
      : Promise.resolve([]),
    getPartials(),
    getReplies(orgId),
    getDateRequests(orgId),
    getUnansweredMessages(orgId),
  ]);
  const messages = unanswered.map((message) => ({
    orderId: message.orderId,
    orderRef: orderNumber(message.orderNumber),
    fromName: message.fromName,
    body: message.body,
  }));
  return buildTodos({ priceChanges, partials, replies, dateRequests, messages }, settings.priceAlerts);
});
