import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { minimumGap } from "@/domain/minimum";
import { formatMoney, toCents } from "@/domain/money";
import { getOrderChanges } from "@/features/buyer/orders/queries";
import { ISSUE_STATUS_PILLS, ISSUE_STATUSES, ISSUE_TYPES, issueAnswer, problemTitle } from "@/features/buyer/orders/summary";
import { getDeliveryTerms } from "@/features/buyer/queries";
import type { OrderView } from "@/features/orders/queries";
import { getOrderRequests } from "@/features/orders/requests";
import { formatDate, formatDateTime } from "@/ui/format";

const money = z.union([z.string(), z.number()]).transform((value) => Number(value).toFixed(2));

const problemSchema = z.object({
  id: z.uuid(),
  type: z.enum(ISSUE_TYPES),
  status: z.enum(ISSUE_STATUSES),
  qty: z.number(),
  amount: money,
  note: z.string().nullable(),
  created_at: z.string(),
  product: z.object({ name: z.string() }).nullable(),
});

const MESSAGES_SHOWN = 6;

/**
 * Everything about one order beyond its lines, so Tradelink AI can explain it: problems reported
 * on it and where each stands, what the supplier could not send, the second delivery, recent
 * messages and date changes, and how far it is below the minimum. Read as the signed-in person.
 */
export async function orderContext(order: OrderView, myOrgId: string) {
  const supabase = await createSupabaseServerClient();
  const [problems, changes, requests, terms] = await Promise.all([
    supabase
      .from("issues")
      .select("id, type, status, qty, amount, note, created_at, product:products(name)")
      .eq("order_id", order.id)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) throw new Error(`Could not load problems: ${error.message}`);
        return z.array(problemSchema).parse(data);
      }),
    getOrderChanges(order.id),
    getOrderRequests(order.id),
    getDeliveryTerms([order.supplier.id]),
  ]);

  const minimumCents = toCents(terms.get(order.supplier.id)?.minimumOrder ?? "0");
  const live = order.status !== "cancelled" && order.status !== "rejected";
  const shortCents = live ? minimumGap(order.totalCents + order.laterCents, minimumCents) : 0;

  const problemFacts = problems.map((problem) => {
    const facts = {
      type: problem.type,
      qty: problem.qty,
      productName: problem.product?.name ?? null,
      status: problem.status,
      amount: problem.amount,
    };
    return {
      issue_id: problem.id,
      problem: problemTitle(facts),
      status: ISSUE_STATUS_PILLS[problem.status].label,
      reported: formatDateTime(problem.created_at),
      ...(problem.note ? { note: problem.note } : {}),
      answer: issueAnswer({ ...facts, supplierName: order.supplier.name }),
    };
  });

  const flags = [
    ...(order.checkStatus === "problem"
      ? [
          `Flagged because a problem was reported: ${problemFacts.map((problem) => `${problem.problem} (${problem.status})`).join("; ") || "details not found"}.`,
        ]
      : []),
    ...(shortCents > 0
      ? [`Below minimum: ${formatMoney(shortCents)} under ${order.supplier.name}'s ${formatMoney(minimumCents)} minimum order.`]
      : []),
    ...(changes.length > 0 ? [`Part accepted: ${order.supplier.name} could not send everything.`] : []),
  ];

  return {
    ...(flags.length > 0 ? { flags } : {}),
    ...(problemFacts.length > 0 ? { problems: problemFacts } : {}),
    ...(changes.length > 0
      ? {
          not_sent: changes.map((change) => ({
            item: change.productName,
            asked: change.asked,
            sent: change.sent,
            rest: change.status === "added" ? "added to the buyer's cart" : change.status === "skipped" ? "skipped" : "not ordered elsewhere yet",
          })),
        }
      : {}),
    ...(requests.length > 0
      ? {
          recent_messages: requests.slice(-MESSAGES_SHOWN).map((request) => ({
            from: request.fromOrgId === myOrgId ? "you" : request.fromName,
            at: formatDateTime(request.createdAt),
            ...(request.kind === "message"
              ? { message: request.body }
              : {
                  date_change: `${request.part === "rest" ? "the rest" : "the order"} to ${formatDate(request.proposedDate ?? "")}`,
                  status: request.status,
                }),
          })),
        }
      : {}),
  };
}
