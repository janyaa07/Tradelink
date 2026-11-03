"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { addedToCartText, ASK_COPY, greetingText, placeCartLabel, placedText, textReply } from "@/domain/ask/replies";
import type { AiCard, AiProposal, AskAction, AskCard, AskReply, AskTurn, CartLine, LineRow, ReadLineStatus } from "@/domain/ask/types";
import { formatMoney } from "@/domain/money";
import { StatusPill } from "@/features/orders/OrderCard";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { formatDate, orderNumber } from "@/ui/format";
import { Icon, type IconName } from "@/ui/Icon";
import { LinkButton } from "@/ui/LinkButton";
import { Pill, type PillTone } from "@/ui/Pill";
import { ProductImage } from "@/ui/ProductImage";
import { executeAiAction } from "@/features/ai/execute";
import { AiCardView } from "@/features/ai/ui/AiCards";
import { parseReply, plainReply } from "@/features/ai/ui/reply-blocks";
import { addToCartAction, placeCartAction } from "./actions";
import styles from "./assistant.module.css";
import {
  conversationsSnapshot,
  loadConversations,
  NO_CONVERSATIONS,
  relativeDay,
  saveConversations,
  subscribeConversations,
  upsertConversation,
  type ChatMessage,
  type Conversation,
} from "./history";

export type AiRole = "buyer" | "supplier";

const SUGGESTIONS: Record<AiRole, { text: string; icon: IconName }[]> = {
  buyer: [
    { text: "Order my usual", icon: "repeat" },
    { text: "What's arriving today?", icon: "truck" },
    { text: "How much did I spend this week?", icon: "receipt" },
    { text: "What's in my cart?", icon: "cart" },
  ],
  supplier: [
    { text: "What new orders do I have?", icon: "list" },
    { text: "What's low in stock?", icon: "stock" },
    { text: "Any problems I need to answer?", icon: "flag" },
    { text: "What goes out for delivery today?", icon: "truck" },
  ],
};

const PLACEHOLDER = "Ask anything, or tell me what to do";

const INTRO: Record<AiRole, string> = {
  buyer: "Ask about orders, stock and spend, or tell it what to order.",
  supplier: "Ask about orders, stock and problems, or tell it what to do.",
};

type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "status"; text: string }
  | { type: "cards"; cards: AskCard[] }
  | { type: "proposal"; proposal: AiProposal }
  | { type: "error"; message: string }
  | { type: "break" }
  | { type: "done" };

/** Shown while Tradelink AI works, so a wait never looks stuck. Tool updates take over when they come. */
const WAITING: Record<AiRole, string[]> = {
  buyer: [
    "Reading your message",
    "Checking your shop",
    "Looking at orders and prices",
    "Comparing your suppliers",
    "Working it out",
    "Putting it together",
  ],
  supplier: [
    "Reading your message",
    "Checking your orders",
    "Looking at your stock",
    "Checking buyers and dates",
    "Working it out",
    "Putting it together",
  ],
};
const WAITING_STEP_MS = 1600;
const QUIET_AFTER_TEXT_MS = 900;


/** Where the person goes next after a confirmed change. */
function linkAfter(role: AiRole, tool: string): AskAction | null {
  if (role === "supplier") {
    if (tool === "update_terms") return { kind: "link", label: "Open settings", href: "/supplier/settings" };
    return ["receive_stock", "change_price", "confirm_stock", "adjust_stock"].includes(tool)
      ? { kind: "link", label: "Open inventory", href: "/supplier/inventory" }
      : { kind: "link", label: "View orders", href: "/supplier/orders" };
  }
  if (["add_to_cart", "set_cart_quantity"].includes(tool)) return { kind: "link", label: "View cart", href: "/buyer/cart" };
  if (["place_order", "order_now", "cancel_order", "confirm_delivery", "report_not_here", "report_problem"].includes(tool)) {
    return { kind: "link", label: "View orders", href: "/buyer/orders" };
  }
  return null;
}

const MAX_CHARS = 2000;
const MAX_HISTORY = 20;
const MAX_INPUT_HEIGHT = 200;

const REVIEW_CART: AskAction = { kind: "link", label: "Review cart", href: "/buyer/cart" };

const STATUS_TONES: Record<ReadLineStatus, PillTone> = { Matched: "good", "Check this": "warn", "Not found": "bad" };

const cardClass = "flex w-full max-w-[520px] flex-col rounded-lg border border-line bg-surface";
const rowClass = "flex items-center justify-between gap-3 px-3.5 py-2.5 text-[.92rem]";

const PLUS = "M12 5v14M5 12h14";
const CLOSE = "M6 6l12 12M18 6L6 18";

function AssistantAvatar() {
  return (
    <span aria-hidden="true" className="ai-tint grid size-8 flex-none place-items-center rounded-full">
      <span className="ai-spark size-4" />
    </span>
  );
}

function StrokeIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] flex-none" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
      <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LineRowView({ row }: { row: LineRow }) {
  return (
    <li className={rowClass}>
      <span className="flex min-w-0 flex-col">
        <span className="[overflow-wrap:anywhere]">{row.label}</span>
        {row.note ? <span className="text-[.8rem] text-muted">{row.note}</span> : null}
      </span>
      <span className="flex flex-none items-center gap-2">
        {row.status ? <Pill tone={STATUS_TONES[row.status]}>{row.status}</Pill> : null}
        {row.price ? <span className="tabular-nums">{row.price}</span> : null}
      </span>
    </li>
  );
}

function CardView({ card }: { card: AskCard }) {
  switch (card.kind) {
    case "order": {
      const { order } = card;
      return (
        <div className={cardClass}>
          <div className={cx(rowClass, "border-b border-line")}>
            <span className="flex min-w-0 flex-col">
              <b className="font-mono">{orderNumber(order.number)}</b>
              <span className="text-[.8rem] text-muted">
                {order.supplierName}
                {order.deliveryDate ? ` · Delivery ${formatDate(order.deliveryDate)}` : null}
              </span>
            </span>
            <StatusPill status={order.status} />
          </div>
          <ul className="flex flex-col py-1">
            {order.lines.map((line, index) => (
              <li key={index} className="px-3.5 py-1 text-[.9rem]">
                {line.qty} × {line.name}
              </li>
            ))}
          </ul>
          <p className={cx(rowClass, "border-t border-line")}>
            <span className="text-muted">Total</span>
            <b className="tabular-nums">{formatMoney(order.totalCents)}</b>
          </p>
        </div>
      );
    }
    case "lines":
      return (
        <ul className={cx(cardClass, "divide-y divide-line")}>
          {card.rows.map((row, index) => (
            <LineRowView key={index} row={row} />
          ))}
        </ul>
      );
    case "price": {
      const { price } = card;
      return (
        <div className={cx(cardClass, "flex-row items-center gap-3 p-3")}>
          <ProductImage art={price.art} category={price.category} name={price.name} decorative />
          <div className="flex min-w-0 flex-col">
            <b className="[overflow-wrap:anywhere]">{price.name}</b>
            <span className="tabular-nums">{price.price}</span>
            <span className="text-[.8rem] text-muted">
              {price.supplierName} · {price.available}
              {price.lastPaid ? ` · You last paid ${price.lastPaid}` : null}
            </span>
          </div>
        </div>
      );
    }
  }
}

type ReplyHandlers = {
  onAdd: (lines: CartLine[]) => Promise<void>;
  onPlace: (draftVersion: number) => Promise<void>;
  onConfirm: (proposal: AiProposal) => Promise<void>;
  onSkip: (proposal: AiProposal) => void;
};

/** A change Tradelink AI wants to make. Nothing happens until the person taps the button. */
function ConfirmCard({
  proposal,
  state,
  handlers,
}: {
  proposal: AiProposal;
  state: "done" | "skipped" | undefined;
  handlers: ReplyHandlers;
}) {
  const [busy, start] = useTransition();
  return (
    <div
      className={cx(
        "w-full max-w-[520px] overflow-hidden rounded-lg border bg-surface shadow-card",
        state === "done" ? "border-good/40" : state === "skipped" ? "border-line opacity-70" : "border-accent/50",
      )}
    >
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <span
          className={cx(
            "mt-0.5 grid size-8 flex-none place-items-center rounded-full",
            state === "done" ? "bg-good-soft text-good" : "bg-accent-soft text-accent",
          )}
        >
          <Icon name={state === "done" ? "check" : "spark"} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[.72rem] font-semibold uppercase tracking-wide text-muted">
            {state === "done" ? "Done" : state === "skipped" ? "Not now" : "Needs your OK"}
          </p>
          <b className="block leading-snug [overflow-wrap:anywhere]">{proposal.title}</b>
        </div>
      </div>
      {proposal.details.length > 0 ? (
        <ul className="mx-3.5 mt-2 flex flex-col gap-0.5 rounded-xl bg-sunken px-3 py-2 text-[.875rem]">
          {proposal.details.map((detail, index) => (
            <li key={index} className="[overflow-wrap:anywhere]">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
      {state ? <div className="h-3" /> : (
        <div className="flex flex-wrap gap-2 px-3.5 pt-3 pb-3.5">
          <Button variant="primary" aria-busy={busy || undefined} disabled={busy} onClick={() => start(() => handlers.onConfirm(proposal))}>
            {busy ? "Working..." : proposal.confirmLabel}
          </Button>
          <Button disabled={busy} onClick={() => handlers.onSkip(proposal)}>
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Buttons under a reply. Add to cart only fills the cart. Place order places the cart as the
 * assistant showed it, and only when the buyer taps it.
 */
function ReplyActions({
  actions,
  done,
  resolved,
  handlers,
}: {
  actions: AskAction[];
  done: boolean;
  resolved: Record<string, "done" | "skipped">;
  handlers: ReplyHandlers;
}) {
  const [busy, start] = useTransition();
  return (
    <div className="flex w-full flex-wrap gap-2">
      {actions.map((action) => {
        switch (action.kind) {
          case "confirm":
            return (
              <ConfirmCard key={action.proposal.id} proposal={action.proposal} state={resolved[action.proposal.id]} handlers={handlers} />
            );
          case "link":
            return (
              <LinkButton key={action.label} href={action.href}>
                {action.label}
              </LinkButton>
            );
          case "add_to_cart":
            return (
              <Button
                key={action.kind}
                variant="primary"
                aria-busy={busy || undefined}
                disabled={busy || done}
                onClick={() => start(() => handlers.onAdd(action.lines))}
              >
                {done ? "Added to cart" : busy ? "Adding..." : "Add to cart"}
              </Button>
            );
          case "place_cart":
            return (
              <Button
                key={action.kind}
                variant="primary"
                aria-busy={busy || undefined}
                disabled={busy || done}
                onClick={() => start(() => handlers.onPlace(action.draftVersion))}
              >
                {done ? "Placed" : busy ? "Placing..." : placeCartLabel(action.orders)}
              </Button>
            );
        }
      })}
    </div>
  );
}

/** A Tradelink AI reply: short words, the cards they place, then any confirm cards and follow-ups. */
function AiReply({
  message,
  handlers,
  streaming,
  onAsk,
  onCard,
  waiting,
}: {
  message: ChatMessage;
  handlers: ReplyHandlers;
  streaming: boolean;
  onAsk: ((text: string) => void) | null;
  onCard: (card: AiCard) => void;
  /** The rotating line shown while Tradelink AI works, inside this reply so there is one avatar. */
  waiting: ReactNode;
}) {
  const { blocks, asks } = parseReply(message.reply.text, streaming);
  const cards = new Map(
    message.reply.cards.filter((card): card is AiCard => card.kind.startsWith("ai_")).map((card) => [card.key, card]),
  );
  if (blocks.length === 0 && message.reply.actions.length === 0) {
    return waiting ? (
      <div className="flex items-center gap-3">
        <AssistantAvatar />
        {waiting}
      </div>
    ) : null;
  }
  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 pt-1">
        <span className="sr-only">Tradelink AI: </span>
        {blocks.map((block, index) => {
          if (block.kind === "text") {
            return (
              <p key={index} className="leading-relaxed [overflow-wrap:anywhere]">
                {block.text}
              </p>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={index} className="flex list-disc flex-col gap-1 pl-5 leading-relaxed marker:text-accent">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            );
          }
          const card = cards.get(block.key);
          return card ? <AiCardView key={`${block.key}-${index}`} card={card} onChange={onCard} /> : null;
        })}
        {waiting}
        {message.reply.actions.length > 0 ? (
          <ReplyActions actions={message.reply.actions} done={message.done} resolved={message.resolved ?? {}} handlers={handlers} />
        ) : null}
        {onAsk && asks.length > 0 ? (
          <div role="group" aria-label="Suggested next questions" className="flex flex-wrap gap-2 pt-0.5">
            {asks.map((ask) => (
              <button
                key={ask}
                type="button"
                onClick={() => onAsk(ask)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[.85rem] font-medium text-ink transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                <Icon name="spark" size={14} className="text-accent" />
                {ask}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageView({ message, handlers }: { message: ChatMessage; handlers: ReplyHandlers }) {
  if (message.from === "buyer") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-line rounded-[20px] rounded-br-md bg-sunken px-4 py-2.5 [overflow-wrap:anywhere]">
          <span className="sr-only">You said: </span>
          {message.reply.text}
        </p>
      </div>
    );
  }
  const { text, cards, actions } = message.reply;
  if (message.segments) {
    return (
      <div className="flex gap-3">
        <AssistantAvatar />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-1">
          <span className="sr-only">Tradelink AI: </span>
          {message.segments.map((segment, index) => {
            if (segment.kind === "text") {
              return segment.text.trim() ? (
                <p key={index} className="whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">
                  {segment.text.trim()}
                </p>
              ) : null;
            }
            if (segment.kind === "card") {
              const card = cards[segment.index];
              return card ? <CardView key={index} card={card} /> : null;
            }
            const action = actions[segment.index];
            return action ? (
              <ReplyActions key={index} actions={[action]} done={message.done} resolved={message.resolved ?? {}} handlers={handlers} />
            ) : null;
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-1">
        {text.trim() ? (
          <p className="whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">
            <span className="sr-only">Tradelink AI: </span>
            {text.trim()}
          </p>
        ) : null}
        {cards.map((card, index) => (
          <CardView key={index} card={card} />
        ))}
        {actions.length > 0 ? (
          <ReplyActions actions={actions} done={message.done} resolved={message.resolved ?? {}} handlers={handlers} />
        ) : null}
      </div>
    </div>
  );
}

type HistoryProps = {
  conversations: Conversation[];
  currentId: string;
  locked: boolean;
  now: Date;
  onOpen: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
};

/** The saved chats, newest first. Used in the laptop column and the phone sheet. */
function HistoryPanel({ conversations, currentId, locked, now, onOpen, onDelete }: HistoryProps) {
  const headingId = useId();
  return (
    <div className="flex min-h-0 w-full flex-col gap-2">
      <h2 id={headingId} className="px-1">
        Recent chats
      </h2>
      {conversations.length === 0 ? (
        <p className="px-1 text-[.875rem] text-muted">Your chats are saved on this device and show here.</p>
      ) : (
        <ul aria-labelledby={headingId} className="-mx-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          {conversations.map((conversation) => {
            const current = conversation.id === currentId;
            return (
              <li key={conversation.id} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(conversation)}
                  disabled={locked}
                  aria-current={current ? "true" : undefined}
                  className={cx(
                    "flex w-full min-w-0 flex-col rounded-md border-0 py-2 pr-10 pl-3 text-left transition-colors duration-150 disabled:cursor-not-allowed",
                    current ? "bg-accent-soft text-ink" : "bg-transparent text-ink hover:bg-sunken",
                  )}
                >
                  <span className="truncate text-[.9rem] font-medium">{conversation.title}</span>
                  <span className="text-[.75rem] text-muted">{relativeDay(conversation.updatedAt, now)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(conversation)}
                  disabled={locked}
                  aria-label={`Delete chat: ${conversation.title}`}
                  title="Delete chat"
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full border-0 bg-transparent text-muted hover:bg-surface hover:text-bad disabled:cursor-not-allowed"
                >
                  <StrokeIcon d={CLOSE} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Chat history on phone: a modal sheet from the left. Escape, the scrim or Close shuts it. */
function HistorySheet({ sheetRef, children }: { sheetRef: RefObject<HTMLDialogElement | null>; children: ReactNode }) {
  return (
    <dialog
      ref={sheetRef}
      aria-label="Chat history"
      className={styles.sheet}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Chat history</p>
          <button
            type="button"
            onClick={() => sheetRef.current?.close()}
            aria-label="Close chat history"
            className="grid size-9 place-items-center rounded-full border-0 bg-transparent text-muted hover:bg-sunken"
          >
            <StrokeIcon d={CLOSE} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function newConversationId(): string {
  return crypto.randomUUID();
}

/**
 * Tradelink Assistant chat (BUY-47). Each chat is saved on this device so the buyer can come back
 * to it; only the open chat's last turns go to the server, as context for the next answer.
 */
type AssistantChatProps = {
  firstName: string;
  userId: string;
  role?: AiRole;
  /** A question asked from Home (?q=&t=), sent as soon as the chat opens. */
  initialQuestion?: { text: string; stamp: string };
};

export function AssistantChat({ firstName, userId, role = "buyer", initialQuestion }: AssistantChatProps) {
  const router = useRouter();
  const inputId = useId();
  const [now] = useState(() => new Date());
  const conversations = useSyncExternalStore(
    subscribeConversations,
    () => conversationsSnapshot(userId),
    () => NO_CONVERSATIONS,
  );
  const [currentId, setCurrentId] = useState(newConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [waitStep, setWaitStep] = useState(0);
  const lastTextAt = useRef(0);
  const [working, setWorking] = useState(false);
  const nextId = useRef(1);
  const currentIdRef = useRef(currentId);
  const messagesRef = useRef<ChatMessage[]>([]);
  /** Guards against a second send before the first reply arrives (state updates are async). */
  const pending = useRef(false);
  /** One idempotency key per Place order button, reused if the buyer taps it again after a failure. */
  const placeKeys = useRef(new Map<string, string>());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const greeting = greetingText(firstName);
  /** No switching chats while a reply or a cart action is on its way, so it lands in the right chat. */
  const locked = thinking || working;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // A question from Home is sent once. A reload of the same ask (same stamp) reopens its chat
  // instead of asking again; the address is left alone, since changing it would reset the page.
  const askedFromHome = useRef(false);
  useEffect(() => {
    if (!initialQuestion || askedFromHome.current) return;
    askedFromHome.current = true;
    const storeKey = `tl-ask:${initialQuestion.stamp}:${initialQuestion.text}`;
    let earlier: string | null = null;
    try {
      earlier = window.sessionStorage.getItem(storeKey);
    } catch {
      earlier = null;
    }
    const saved = earlier ? loadConversations(userId).find((conversation) => conversation.id === earlier) : undefined;
    if (saved) {
      openConversation(saved.id, saved.messages);
      return;
    }
    try {
      window.sessionStorage.setItem(storeKey, currentIdRef.current);
    } catch {
      // Without session storage a reload asks again, which is harmless.
    }
    void send(initialQuestion.text);
  });

  useEffect(() => {
    if (!thinking) return;
    const timer = setInterval(() => setWaitStep((step) => step + 1), WAITING_STEP_MS);
    return () => clearInterval(timer);
  }, [thinking]);

  useEffect(() => {
    if (messages.length > 0 || thinking) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thinking]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    // The height includes the border, which scrollHeight leaves out.
    const border = input.offsetHeight - input.clientHeight;
    input.style.height = `${Math.min(input.scrollHeight + border, MAX_INPUT_HEIGHT)}px`;
  }, [draft]);

  /** Every change to the open chat: shown, and saved to this device's history. */
  const commit = (next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
    if (next.length > 0) {
      saveConversations(userId, upsertConversation(loadConversations(userId), currentIdRef.current, next, new Date()));
    }
  };

  const append = (from: ChatMessage["from"], reply: AskReply) =>
    commit([...messagesRef.current, { id: nextId.current++, from, reply, done: false }]);

  /** Streaming updates to the reply being written: shown at once, saved when the reply ends. */
  const patch = (messageId: number, change: (message: ChatMessage) => ChatMessage) => {
    messagesRef.current = messagesRef.current.map((message) => (message.id === messageId ? change(message) : message));
    setMessages(messagesRef.current);
  };

  const resolve = (messageId: number, proposalId: string, state: "done" | "skipped") =>
    commit(
      messagesRef.current.map((message) =>
        message.id === messageId ? { ...message, resolved: { ...message.resolved, [proposalId]: state } } : message,
      ),
    );

  /** A card changed after one of its buttons (for example, an order now accepted): saved with the chat. */
  const updateCard = (messageId: number, card: AiCard) =>
    commit(
      messagesRef.current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              reply: {
                ...message.reply,
                cards: message.reply.cards.map((entry) => ("key" in entry && entry.key === card.key ? card : entry)),
              },
            }
          : message,
      ),
    );

  const markDone = (messageId: number) =>
    commit(messagesRef.current.map((message) => (message.id === messageId ? { ...message, done: true } : message)));

  const focusInput = () => inputRef.current?.focus();

  function openConversation(id: string, restored: ChatMessage[]) {
    currentIdRef.current = id;
    setCurrentId(id);
    messagesRef.current = restored;
    setMessages(restored);
    nextId.current = restored.reduce((max, message) => Math.max(max, message.id), 0) + 1;
    setDraft("");
    sheetRef.current?.close();
    focusInput();
  }

  const startNewChat = () => openConversation(newConversationId(), []);

  const deleteConversation = (conversation: Conversation) => {
    saveConversations(
      userId,
      loadConversations(userId).filter((saved) => saved.id !== conversation.id),
    );
    if (conversation.id === currentIdRef.current) startNewChat();
  };

  async function send(text: string) {
    const question = text.trim().slice(0, MAX_CHARS);
    if (question === "" || pending.current) return;
    pending.current = true;
    const history: AskTurn[] = messagesRef.current
      .slice(-MAX_HISTORY)
      .map((message) => ({ role: message.from, text: (message.ai ? plainReply(message.reply.text) : message.reply.text).slice(0, MAX_CHARS) }));
    append("buyer", textReply(question));
    setDraft("");
    setThinking(true);
    setStatus(null);
    setWaitStep(0);
    lastTextAt.current = 0;
    const replyId = nextId.current++;
    commit([
      ...messagesRef.current,
      { id: replyId, ai: true, from: "tradelink", reply: { text: "", cards: [], actions: [] }, done: false },
    ]);
    let newParagraph = false;
    const held: AskAction[] = [];
    const addText = (text: string) => {
      lastTextAt.current = Date.now();
      const joiner = newParagraph ? "\n\n" : "";
      patch(replyId, (message) => ({ ...message, reply: { ...message.reply, text: message.reply.text + joiner + text } }));
      newParagraph = false;
    };
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      if (!response.body) throw new Error("no body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          const event = JSON.parse(raw) as StreamEvent;
          if (event.type === "text") {
            addText(event.delta);
            setStatus(null);
          } else if (event.type === "status") {
            setStatus(event.text);
            setWaitStep(0);
          } else if (event.type === "break") newParagraph = true;
          else if (event.type === "error") addText(event.message);
          else if (event.type === "cards") {
            // Ready for the answer to place; only the cards it tags are drawn.
            patch(replyId, (message) => ({ ...message, reply: { ...message.reply, cards: [...message.reply.cards, ...event.cards] } }));
          } else if (event.type === "proposal") held.push({ kind: "confirm", proposal: event.proposal });
        }
      }
    } catch {
      addText(ASK_COPY.unavailable);
    }
    // Confirm cards follow the answer, so nothing jumps while it is written.
    if (held.length > 0) patch(replyId, (message) => ({ ...message, reply: { ...message.reply, actions: [...message.reply.actions, ...held] } }));
    const reply = messagesRef.current.find((message) => message.id === replyId);
    if (reply && !reply.reply.text.trim() && reply.reply.cards.length === 0 && reply.reply.actions.length === 0) addText(ASK_COPY.unavailable);
    commit(messagesRef.current);
    pending.current = false;
    setThinking(false);
    setStatus(null);
    focusInput();
  }

  const handlersFor = (messageId: number): ReplyHandlers => ({
    onConfirm: async (proposal) => {
      setWorking(true);
      let result: Awaited<ReturnType<typeof executeAiAction>>;
      try {
        result = await executeAiAction({ id: proposal.id, tool: proposal.tool, args: proposal.args });
      } catch {
        result = { ok: false, error: ASK_COPY.unavailable };
      }
      setWorking(false);
      if (!result.ok) {
        append("tradelink", textReply(result.error));
        return;
      }
      resolve(messageId, proposal.id, "done");
      const link = linkAfter(role, proposal.tool);
      append("tradelink", { text: result.data, cards: [], actions: link ? [link] : [] });
      router.refresh();
    },
    onSkip: (proposal) => {
      resolve(messageId, proposal.id, "skipped");
      append("tradelink", textReply("Okay, nothing changed."));
    },
    onAdd: async (lines) => {
      setWorking(true);
      let result: Awaited<ReturnType<typeof addToCartAction>>;
      try {
        result = await addToCartAction(lines);
      } catch {
        result = { ok: false, error: ASK_COPY.unavailable };
      }
      setWorking(false);
      if (!result.ok) {
        append("tradelink", textReply(result.error));
        return;
      }
      markDone(messageId);
      append("tradelink", {
        text: addedToCartText(result.data.added),
        cards: [],
        actions: [{ kind: "link", label: "View cart", href: "/buyer/cart" }],
      });
      router.refresh();
    },
    onPlace: async (draftVersion) => {
      const button = `${currentIdRef.current}:${messageId}`;
      const key = placeKeys.current.get(button) ?? crypto.randomUUID();
      placeKeys.current.set(button, key);
      setWorking(true);
      let result: Awaited<ReturnType<typeof placeCartAction>>;
      try {
        result = await placeCartAction(draftVersion, key);
      } catch {
        result = { ok: false, error: ASK_COPY.unavailable };
      }
      setWorking(false);
      if (!result.ok) {
        append("tradelink", { text: result.error, cards: [], actions: [REVIEW_CART] });
        return;
      }
      markDone(messageId);
      append("tradelink", {
        text: placedText(
          result.data.orders.map((order) => ({ number: orderNumber(order.number), supplierName: order.supplierName })),
        ),
        cards: [],
        actions: [{ kind: "link", label: "View orders", href: "/buyer/orders" }],
      });
      router.refresh();
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send(draft);
  }

  const empty = messages.length === 0 && !thinking;
  const historyPanel = (
    <HistoryPanel
      conversations={conversations}
      currentId={currentId}
      locked={locked}
      now={now}
      onOpen={(conversation) => openConversation(conversation.id, conversation.messages)}
      onDelete={deleteConversation}
    />
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h1 className="ai-text self-start">Tradelink AI</h1>
          <p className="text-muted">{INTRO[role]}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => sheetRef.current?.showModal()} className="min-[900px]:hidden">
            <Icon name="history" size={18} />
            History
          </Button>
          <Button onClick={startNewChat} disabled={locked || empty}>
            <StrokeIcon d={PLUS} />
            New chat
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 min-[900px]:grid-cols-[248px_minmax(0,1fr)]">
        <aside
          aria-label="Chat history"
          className="sticky top-0 hidden max-h-[calc(100dvh-12rem)] overflow-hidden rounded-lg border border-line bg-surface p-3 shadow-card min-[900px]:flex"
        >
          {historyPanel}
        </aside>
        <HistorySheet sheetRef={sheetRef}>{historyPanel}</HistorySheet>
        <section
          aria-label="Chat"
          className="flex min-h-[calc(100dvh-15rem)] min-w-0 flex-col rounded-lg border border-line bg-surface shadow-card"
        >
          <div className="flex flex-1 flex-col px-3.5 pt-4 rail:px-5">
            {empty ? (
              <div className="flex flex-1 flex-col justify-center gap-5 py-6">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="ai-tint grid size-11 flex-none place-items-center rounded-full">
                    <span className="ai-spark size-[22px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="ai-text text-[1.4rem] font-semibold leading-tight tracking-[-0.02em]">{greeting.hello}</p>
                    <p className="text-muted">{greeting.ask}</p>
                  </div>
                </div>
                <div role="group" aria-label="Suggestions" className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
                  {SUGGESTIONS[role].map((suggestion) => (
                    <button
                      key={suggestion.text}
                      type="button"
                      onClick={() => void send(suggestion.text)}
                      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-[.92rem] font-medium text-ink transition-colors duration-150 hover:border-accent hover:bg-sunken/50"
                    >
                      <span className="grid size-9 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
                        <Icon name={suggestion.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">{suggestion.text}</span>
                      <Icon name="arrow" size={16} className="text-muted" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div role="log" aria-live="polite" aria-label="Conversation with Tradelink AI" className={cx("flex flex-col gap-6", !empty && "pb-4")}>
              {messages.map((message, index) =>
                message.ai ? (
                  <AiReply
                    key={message.id}
                    message={message}
                    handlers={handlersFor(message.id)}
                    streaming={thinking && index === messages.length - 1}
                    onAsk={!thinking && index === messages.length - 1 ? (ask) => void send(ask) : null}
                    onCard={(card) => updateCard(message.id, card)}
                    waiting={
                      thinking && index === messages.length - 1 && Date.now() - lastTextAt.current > QUIET_AFTER_TEXT_MS ? (
                        <p key={`${status ?? ""}${waitStep}`} aria-live="polite" className={cx(styles.thinking, styles.waitLine, "font-medium")}>
                          {status && waitStep === 0 ? status : WAITING[role][waitStep % WAITING[role].length]}...
                        </p>
                      ) : null
                    }
                  />
                ) : (
                  <MessageView key={message.id} message={message} handlers={handlersFor(message.id)} />
                ),
              )}
            </div>
            <div ref={endRef} aria-hidden="true" className="scroll-mb-32" />
          </div>
          <div className="sticky bottom-0 z-10 rounded-b-lg border-t border-line bg-surface px-3.5 pt-3 pb-2.5 rail:px-5">
            <form onSubmit={onSubmit} aria-busy={thinking || undefined} className="ai-ring flex items-end gap-2 rounded-2xl p-1.5 pl-4">
              <label htmlFor={inputId} className="sr-only">
                Message Tradelink AI
              </label>
              <textarea
                id={inputId}
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={MAX_CHARS}
                autoComplete="off"
                enterKeyHint="send"
                placeholder={PLACEHOLDER}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                className="max-h-[200px] min-w-0 flex-1 resize-none self-center border-0 bg-transparent py-2 text-[.95rem] leading-6 text-ink outline-none placeholder:text-muted"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={thinking || draft.trim() === ""}
                className="ai-fill grid size-10 flex-none place-items-center rounded-xl transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendIcon />
              </button>
            </form>
            <p className="mt-1.5 text-[.75rem] text-muted">Tradelink AI asks you to confirm before it changes anything.</p>
          </div>
        </section>
      </div>
    </>
  );
}
