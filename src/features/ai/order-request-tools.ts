import "server-only";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { formatMoney } from "@/domain/money";
import { singaporeDateOf } from "@/domain/singapore-time";
import { getOrderRequests } from "@/features/orders/requests";
import { formatDate, orderNumber } from "@/ui/format";
import { readTool, writeTool, type AiContext, type AiTool } from "./registry";
import { findOrder, NOT_FOUND, orderNumberInput } from "./shared";

/**
 * Talking to the other side of an order, for buyers and suppliers alike: messages, delivery date
 * changes the other side has to agree to, and calling off the rest of a two-delivery order.
 */

const partInput = z
  .enum(["first", "rest"])
  .default("first")
  .describe('"first" for the order (or its first delivery), "rest" for the second delivery of a part-accepted order');

const otherName = (ctx: AiContext, order: { buyer: { name: string }; supplier: { name: string } }) =>
  ctx.role === "buyer" ? order.supplier.name : order.buyer.name;

export function orderRequestTools(role: AiContext["role"]): AiTool[] {
  const other = role === "buyer" ? "supplier" : "buyer";
  return [
    readTool({
      name: "get_order_messages",
      description: `Messages and delivery date changes on one order, oldest first, with request_id for date changes the ${other} asked for that are waiting for an answer.`,
      input: z.object({ order_number: orderNumberInput }),
      run: async (ctx, { order_number }) => {
        const order = await findOrder(order_number);
        if (!order) return { data: NOT_FOUND };
        const requests = await getOrderRequests(order.id);
        return {
          data: {
            order: orderNumber(order.number),
            messages: requests.map((request) => ({
              from: request.fromOrgId === ctx.session.orgId ? "you" : request.fromName,
              at: request.createdAt.slice(0, 16).replace("T", " "),
              ...(request.kind === "message"
                ? { message: request.body }
                : {
                    date_change: `${request.part === "rest" ? "the rest" : "the order"} to ${request.proposedDate}`,
                    status: request.status,
                    ...(request.body ? { reason: request.body } : {}),
                    ...(request.answer ? { reply: request.answer } : {}),
                    ...(request.status === "open" && request.fromOrgId !== ctx.session.orgId ? { request_id: request.id } : {}),
                  }),
            })),
          },
        };
      },
    }),

    writeTool({
      name: `message_${other}`,
      description:
        `Send the ${other} a short message about one order, such as asking them to send as much as they can today, or answering their question. ` +
        `Write it in plain words as the person would, up to 500 characters. If the person does not name an order, use their latest open order with that ${other} from list_orders; if there is none, say so.`,
      input: z.object({ order_number: orderNumberInput, message: z.string().trim().min(1).max(500) }),
      propose: async (ctx, { order_number, message }) => {
        const order = await findOrder(order_number);
        if (!order) return NOT_FOUND;
        return {
          title: `Message ${otherName(ctx, order)} about ${orderNumber(order.number)}`,
          details: [message],
          confirmLabel: "Send message",
          args: { order_number, message, order_id: order.id },
        };
      },
      exec: async (_ctx, args, key) => {
        const result = await callRpc("send_order_message", {
          p_order: String((args as { order_id?: string }).order_id),
          p_body: args.message,
          p_key: key,
        });
        return result.ok ? { ok: true, data: "Message sent. They see it on the order and in their alerts." } : result;
      },
    }),

    writeTool({
      name: "request_date_change",
      description:
        `Ask the ${other} to move a delivery to another day (new_date as YYYY-MM-DD, Singapore time). The date only changes if they agree; ` +
        "they are told and can accept or decline. Works while the order is pending or accepted, or for the rest of a part-accepted order while it waits.",
      input: z.object({
        order_number: orderNumberInput,
        part: partInput,
        new_date: z.iso.date(),
        reason: z.string().trim().max(500).optional(),
      }),
      propose: async (ctx, { order_number, part, new_date, reason }) => {
        const order = await findOrder(order_number);
        if (!order) return NOT_FOUND;
        if (new_date < singaporeDateOf(ctx.now)) return { error: "That date has passed. Choose today or later." };
        const ref = orderNumber(order.number);
        if (part === "rest" && order.later?.status !== "waiting") return { error: `${ref} has no rest waiting to be delivered.` };
        if (part === "first" && order.status !== "pending" && order.status !== "accepted") {
          return { error: `${ref} is ${order.status.replace(/_/g, " ")}, so its date can no longer change.` };
        }
        const current = part === "rest" ? order.later?.date : (order.confirmedDeliveryDate ?? order.requestedDeliveryDate);
        const name = otherName(ctx, order);
        return {
          title: `Ask ${name} to move ${part === "rest" ? `the rest of ${ref}` : ref} to ${formatDate(new_date)}`,
          details: [
            ...(current ? [`Now ${formatDate(current)}`] : []),
            ...(reason ? [`Reason: ${reason}`] : []),
            `${name} has to agree before it changes.`,
          ],
          confirmLabel: "Ask for new date",
          args: { order_number, part, new_date, reason, order_id: order.id },
        };
      },
      exec: async (_ctx, args, key) => {
        const result = await callRpc("propose_delivery_date", {
          p_order: String((args as { order_id?: string }).order_id),
          p_part: args.part,
          p_date: args.new_date,
          p_note: args.reason ?? null,
          p_key: key,
        });
        return result.ok ? { ok: true, data: `Asked for ${formatDate(args.new_date)}. You will be told when they answer.` } : result;
      },
    }),

    writeTool({
      name: "answer_date_change",
      description: `Accept or decline a delivery date change the ${other} asked for. Use request_id from get_order_messages.`,
      input: z.object({ order_number: orderNumberInput, request_id: z.uuid(), accept: z.boolean() }),
      propose: async (ctx, { order_number, request_id, accept }) => {
        const order = await findOrder(order_number);
        if (!order) return NOT_FOUND;
        const request = (await getOrderRequests(order.id)).find((entry) => entry.id === request_id);
        if (!request || request.kind !== "date_change" || request.status !== "open" || request.fromOrgId === ctx.session.orgId) {
          return { error: "That request is not waiting for your answer. Call get_order_messages again." };
        }
        const what = request.part === "rest" ? `the rest of ${orderNumber(order.number)}` : orderNumber(order.number);
        return {
          title: `${accept ? "Agree to move" : "Decline moving"} ${what} to ${formatDate(request.proposedDate ?? "")}`,
          details: [`Asked by ${request.fromName}`, ...(request.body ? [`Reason: ${request.body}`] : [])],
          confirmLabel: accept ? "Accept new date" : "Decline",
          args: { order_number, request_id, accept },
        };
      },
      exec: async (_ctx, args, key) => {
        const result = await callRpc("answer_delivery_date", { p_request: args.request_id, p_accept: args.accept, p_note: null, p_key: key });
        return result.ok ? { ok: true, data: args.accept ? "New date agreed. They have been told." : "Declined. The date stays as it was." } : result;
      },
    }),

    writeTool({
      name: "cancel_rest",
      description: "Call off the rest of a part-accepted order (its second delivery) before it goes out. The first delivery is not affected.",
      input: z.object({ order_number: orderNumberInput }),
      propose: async (ctx, { order_number }) => {
        const order = await findOrder(order_number);
        if (!order) return NOT_FOUND;
        const ref = orderNumber(order.number);
        if (order.later?.status !== "waiting") return { error: `${ref} has no rest waiting.` };
        return {
          title: `Cancel the rest of ${ref}`,
          details: [
            `${otherName(ctx, order)} · was coming ${formatDate(order.later.date)} · ${formatMoney(order.laterCents)}`,
            ...order.lines.filter((line) => line.laterQty > 0).map((line) => `${line.laterQty} × ${line.name}`),
          ],
          confirmLabel: "Cancel the rest",
          args: { order_number, order_id: order.id },
        };
      },
      exec: async (_ctx, args, key) => {
        const result = await callRpc("cancel_rest", { p_order: String((args as { order_id?: string }).order_id), p_key: key });
        return result.ok ? { ok: true, data: "The rest is cancelled and the other side told." } : result;
      },
    }),
  ];
}
