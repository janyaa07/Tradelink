import { formatMoney, toCents } from "./money";

/** The buyer's To do list on Home (BUY-02, BUY-03, BUY-04). */
export type TodoTone = "good" | "warn" | "bad";

export type PriceChangeInput = { id: string; productName: string; supplierName: string; oldPrice: string; newPrice: string };
export type PartialInput = {
  id: string;
  /** The order the part delivery belongs to, for the alert's link. */
  orderId?: string | null;
  productName: string;
  supplierName: string;
  orderRef: string;
  asked: number;
  sent: number;
};
export type ReplyInput = {
  id: string;
  orderRef: string;
  /** The order the problem is on, for the alert's link. */
  orderId?: string | null;
  supplierName: string;
  status: string;
  amount: string;
};

/** A delivery date change the supplier asked for; dates come already written out, such as "Sat 14 Nov". */
export type DateRequestInput = {
  id: string;
  orderId: string;
  orderRef: string;
  supplierName: string;
  /** True when it is about the second delivery of a part-accepted order. */
  rest: boolean;
  from: string | null;
  to: string;
  note: string | null;
};

/** The other side's latest message on an order, waiting for a reply. */
export type MessageInput = { orderId: string; orderRef: string; fromName: string; body: string };

export type TodoAction =
  | { kind: "price"; id: string }
  | { kind: "partial"; id: string; remainder: number }
  | { kind: "reply"; id: string }
  /** A promised credit: the buyer marks it received once it arrives. */
  | { kind: "credit"; id: string }
  /** The supplier asks to move a delivery; the buyer accepts or declines. */
  | { kind: "date"; id: string }
  /** A message waiting for a reply; id is the order. */
  | { kind: "message"; id: string };

export type Todo = {
  key: string;
  tone: TodoTone;
  title: string;
  detail: string;
  action: TodoAction;
  /** The order the alert is about, when there is one. */
  orderId?: string;
};

/** Percentage change to one decimal, without a sign: "4.2". */
export function percentChange(oldPrice: string, newPrice: string): string {
  const before = toCents(oldPrice);
  if (before === 0) return "0.0";
  return ((Math.abs(toCents(newPrice) - before) / before) * 100).toFixed(1);
}

function priceTodo(change: PriceChangeInput): Todo {
  const up = toCents(change.newPrice) > toCents(change.oldPrice);
  return {
    key: `price-${change.id}`,
    tone: up ? "warn" : "good",
    title: `${change.productName} ${up ? "went up" : "went down"} ${percentChange(change.oldPrice, change.newPrice)}%`,
    detail: `${formatMoney(change.oldPrice)} to ${formatMoney(change.newPrice)} at ${change.supplierName}.`,
    action: { kind: "price", id: change.id },
  };
}

function partialTodo(partial: PartialInput): Todo {
  return {
    key: `partial-${partial.id}`,
    tone: "warn",
    title: `${partial.supplierName} can only send ${partial.sent} of ${partial.asked}`,
    detail: `${partial.productName} on ${partial.orderRef}.`,
    action: { kind: "partial", id: partial.id, remainder: Math.max(1, partial.asked - partial.sent) },
    ...(partial.orderId ? { orderId: partial.orderId } : {}),
  };
}

/** Copy for each answered status (DISCOVERY B1). Open and credit received need no reply item. */
export function replyText(status: string, supplierName: string, amount: string): string | null {
  switch (status) {
    case "credit_promised":
      return `${supplierName} will credit ${formatMoney(amount)}.`;
    case "replacement_promised":
      return `${supplierName} will replace this on the next delivery.`;
    case "supplier_replied":
      return `${supplierName} says it is on the way.`;
    case "disputed":
      return `${supplierName} disputes this. Tradelink is reviewing it.`;
    case "closed":
      return "Tradelink reviewed this and closed it with no credit.";
    default:
      return null;
  }
}

function replyTodo(reply: ReplyInput): Todo | null {
  const detail = replyText(reply.status, reply.supplierName, reply.amount);
  if (!detail) return null;
  return {
    key: `reply-${reply.id}`,
    tone: reply.status === "disputed" ? "bad" : "good",
    title: `Reply on ${reply.orderRef}`,
    detail,
    action: reply.status === "credit_promised" ? { kind: "credit", id: reply.id } : { kind: "reply", id: reply.id },
    ...(reply.orderId ? { orderId: reply.orderId } : {}),
  };
}

function dateTodo(request: DateRequestInput): Todo {
  return {
    key: `date-${request.id}`,
    tone: "warn",
    title: `${request.supplierName} asks to move ${request.rest ? "the rest of " : ""}${request.orderRef}`,
    detail: `${request.from ? `From ${request.from} to ${request.to}` : `To ${request.to}`}.${request.note ? ` "${request.note}"` : ""}`,
    action: { kind: "date", id: request.id },
    orderId: request.orderId,
  };
}

const QUOTE_LENGTH = 120;

function messageTodo(message: MessageInput): Todo {
  const body = message.body.length > QUOTE_LENGTH ? `${message.body.slice(0, QUOTE_LENGTH - 3)}...` : message.body;
  return {
    key: `message-${message.orderId}`,
    tone: "warn",
    title: `${message.fromName} wrote about ${message.orderRef}`,
    detail: `"${body}"`,
    action: { kind: "message", id: message.orderId },
    orderId: message.orderId,
  };
}

const TONE_ORDER: Record<TodoTone, number> = { bad: 0, warn: 1, good: 2 };

type TodoInputs = {
  priceChanges: PriceChangeInput[];
  partials: PartialInput[];
  replies: ReplyInput[];
  dateRequests?: DateRequestInput[];
  messages?: MessageInput[];
};

/** Price changes (only when price alerts are on), part deliveries, replies and date requests; most urgent first. */
export function buildTodos(inputs: TodoInputs, priceAlerts: boolean): Todo[] {
  const items = [
    ...(priceAlerts ? inputs.priceChanges.map(priceTodo) : []),
    ...inputs.partials.map(partialTodo),
    ...inputs.replies.map(replyTodo).filter((todo): todo is Todo => todo !== null),
    ...(inputs.dateRequests ?? []).map(dateTodo),
    ...(inputs.messages ?? []).map(messageTodo),
  ];
  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
