import { z } from "zod";
import { ASK_LINK_LABELS, type AskReply } from "@/domain/ask/types";
import { ART_KINDS, CATEGORIES } from "@/domain/catalogue";
import { DRAFT_STATES } from "@/features/ordering/draft";

/**
 * Tradelink Assistant chat history, kept in this browser only (localStorage, per user). It holds
 * what the buyer already saw on screen; nothing in it is sent anywhere except the last turns of
 * the open chat, as context for the next answer. Every read is validated, so a stale or edited
 * entry is dropped rather than breaking the page.
 */

export const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 200;
const MAX_TITLE = 60;
const STORAGE_PREFIX = "tradelink.assistant.v1.";

const ORDER_STATUSES = ["pending", "accepted", "out_for_delivery", "delivered", "rejected", "cancelled"] as const;
const LINE_STATUSES = ["Matched", "Check this", "Not found"] as const;

const cartLineSchema = z.object({
  productId: z.string().nullable(),
  qty: z.number(),
  sourceText: z.string(),
  options: z.array(z.string()),
  state: z.enum(DRAFT_STATES),
  kg: z.number().nullable(),
  qtyAssumed: z.boolean(),
});

const cardSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("order"),
    order: z.object({
      number: z.number(),
      status: z.enum(ORDER_STATUSES),
      supplierName: z.string(),
      deliveryDate: z.string().nullable(),
      lines: z.array(z.object({ qty: z.number(), name: z.string() })),
      totalCents: z.number(),
    }),
  }),
  z.object({
    kind: z.literal("price"),
    price: z.object({
      name: z.string(),
      art: z.enum(ART_KINDS),
      category: z.enum(CATEGORIES),
      price: z.string(),
      supplierName: z.string(),
      available: z.string(),
      lastPaid: z.string().nullable(),
    }),
  }),
  z.object({
    kind: z.literal("lines"),
    rows: z.array(
      z.object({
        label: z.string(),
        status: z.enum(LINE_STATUSES).nullable(),
        note: z.string().nullable(),
        price: z.string().nullable(),
      }),
    ),
  }),
]);

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("link"), label: z.enum(ASK_LINK_LABELS), href: z.string().regex(/^\/(buyer|supplier)(\/|$)/) }),
  z.object({ kind: z.literal("add_to_cart"), lines: z.array(cartLineSchema) }),
  z.object({ kind: z.literal("place_cart"), draftVersion: z.number(), orders: z.number() }),
  z.object({
    kind: z.literal("confirm"),
    proposal: z.object({
      id: z.uuid(),
      tool: z.string().regex(/^[a-z_]{2,40}$/),
      args: z.record(z.string(), z.unknown()),
      title: z.string().max(200),
      details: z.array(z.string().max(300)).max(40),
      confirmLabel: z.string().max(40),
    }),
  }),
]);

const messageSchema = z.object({
  id: z.number(),
  from: z.enum(["buyer", "tradelink"]),
  reply: z.object({ text: z.string(), cards: z.array(cardSchema), actions: z.array(actionSchema) }),
  /** The reply's button was used: Add to cart added, or Place order placed. */
  done: z.boolean(),
  /** Tradelink AI confirm cards the person answered, by proposal id. */
  resolved: z.record(z.string(), z.enum(["done", "skipped"])).optional(),
  /** Tradelink AI replies: text, cards and confirm cards in the order they arrived. */
  segments: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("text"), text: z.string() }),
        z.object({ kind: z.literal("card"), index: z.number().int().min(0) }),
        z.object({ kind: z.literal("action"), index: z.number().int().min(0) }),
      ]),
    )
    .optional(),
});

const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  updatedAt: z.string(),
  messages: z.array(messageSchema).max(MAX_MESSAGES),
});

export type ChatMessage = {
  id: number;
  from: "buyer" | "tradelink";
  reply: AskReply;
  done: boolean;
  resolved?: Record<string, "done" | "skipped">;
  segments?: Segment[];
};

/** One piece of a streamed reply. Cards and actions point into reply.cards and reply.actions. */
export type Segment = { kind: "text"; text: string } | { kind: "card"; index: number } | { kind: "action"; index: number };
export type Conversation = { id: string; title: string; updatedAt: string; messages: ChatMessage[] };

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readRaw(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/** Every valid saved chat, newest first. Unreadable entries are skipped; no storage gives []. */
export function loadConversations(userId: string): Conversation[] {
  return parseConversations(readRaw(userId));
}

export function parseConversations(raw: string | null): Conversation[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .flatMap((entry) => {
      const parsed = conversationSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
}

const listeners = new Set<() => void>();
let snapshot: { userId: string; raw: string | null; conversations: Conversation[] } | null = null;

/** The server and first render see no history; the browser's list arrives after hydration. */
export const NO_CONVERSATIONS: Conversation[] = [];

/** For useSyncExternalStore: saves from this tab and from other tabs both update the list. */
export function subscribeConversations(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The saved list, parsed again only when the stored text changes, so the reference is stable. */
export function conversationsSnapshot(userId: string): Conversation[] {
  const raw = readRaw(userId);
  if (snapshot && snapshot.userId === userId && snapshot.raw === raw) return snapshot.conversations;
  snapshot = { userId, raw, conversations: raw ? parseConversations(raw) : NO_CONVERSATIONS };
  return snapshot.conversations;
}

/** Saves the list; a full or blocked storage is ignored, since the chat works without it. */
export function saveConversations(userId: string, conversations: Conversation[]): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // Storage unavailable or full: history is a convenience, so the chat carries on unsaved.
  }
  for (const listener of listeners) listener();
}

/** The chat's title: its first buyer message on one line, shortened. */
export function conversationTitle(messages: ChatMessage[]): string {
  const first = messages.find((message) => message.from === "buyer")?.reply.text ?? "New chat";
  const line = first.replace(/\s+/g, " ").trim();
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1).trimEnd()}…` : line;
}

/** Puts the open chat first with its new messages, keeping at most MAX_CONVERSATIONS. */
export function upsertConversation(
  conversations: Conversation[],
  id: string,
  messages: ChatMessage[],
  now: Date,
): Conversation[] {
  const updated: Conversation = {
    id,
    title: conversationTitle(messages),
    updatedAt: now.toISOString(),
    messages: messages.slice(-MAX_MESSAGES),
  };
  return [updated, ...conversations.filter((conversation) => conversation.id !== id)].slice(0, MAX_CONVERSATIONS);
}

const SINGAPORE_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" });
const SHORT_DATE = new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short" });

/** "Today", "Yesterday" or "3 Nov", in Singapore time. */
export function relativeDay(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = SINGAPORE_DATE.format(date);
  if (day === SINGAPORE_DATE.format(now)) return "Today";
  if (day === SINGAPORE_DATE.format(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return SHORT_DATE.format(date);
}
