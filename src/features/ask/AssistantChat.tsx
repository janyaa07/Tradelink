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
import type { AskAction, AskCard, AskReply, AskTurn, CartLine, LineRow, ReadLineStatus } from "@/domain/ask/types";
import { formatMoney } from "@/domain/money";
import { StatusPill } from "@/features/orders/OrderCard";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { formatDate, orderNumber } from "@/ui/format";
import { Icon, type IconName } from "@/ui/Icon";
import { LinkButton } from "@/ui/LinkButton";
import { Pill, type PillTone } from "@/ui/Pill";
import { ProductImage } from "@/ui/ProductImage";
import { addToCartAction, askAction, placeCartAction } from "./actions";
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

const SUGGESTIONS: { text: string; icon: IconName }[] = [
  { text: "Order my usual", icon: "repeat" },
  { text: "What's arriving today?", icon: "truck" },
  { text: "How much did I spend this week?", icon: "receipt" },
  { text: "What's in my cart?", icon: "cart" },
];

const MAX_CHARS = 2000;
const MAX_HISTORY = 20;
const MAX_INPUT_HEIGHT = 200;

const REVIEW_CART: AskAction = { kind: "link", label: "Review cart", href: "/buyer/cart" };

const STATUS_TONES: Record<ReadLineStatus, PillTone> = { Matched: "good", "Check this": "warn", "Not found": "bad" };

const cardClass = "flex w-full max-w-[480px] flex-col rounded-xl border border-line bg-surface";
const rowClass = "flex items-center justify-between gap-3 px-3.5 py-2.5 text-[.92rem]";

const toolButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[.875rem] font-semibold text-ink transition-colors duration-150 hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

const PLUS = "M12 5v14M5 12h14";
const CLOSE = "M6 6l12 12M18 6L6 18";

function AssistantAvatar() {
  return (
    <span aria-hidden="true" className={cx("grid size-8 flex-none place-items-center rounded-full", styles.avatar)}>
      <svg viewBox="0 0 24 24" className="size-[18px]" focusable="false">
        <path d="M12 2c.6 4.8 3.2 7.4 8 8-4.8.6-7.4 3.2-8 8-.6-4.8-3.2-7.4-8-8 4.8-.6 7.4-3.2 8-8z" fill="currentColor" />
      </svg>
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
};

/**
 * Buttons under a reply. Add to cart only fills the cart. Place order places the cart as the
 * assistant showed it, and only when the buyer taps it.
 */
function ReplyActions({ actions, done, handlers }: { actions: AskAction[]; done: boolean; handlers: ReplyHandlers }) {
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        switch (action.kind) {
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
  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-1">
        <p className="whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">
          <span className="sr-only">Tradelink Assistant: </span>
          {text}
        </p>
        {cards.map((card, index) => (
          <CardView key={index} card={card} />
        ))}
        {actions.length > 0 ? <ReplyActions actions={actions} done={message.done} handlers={handlers} /> : null}
      </div>
    </div>
  );
}

type HistoryProps = {
  conversations: Conversation[];
  currentId: string;
  locked: boolean;
  now: Date;
  onNew: () => void;
  onOpen: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
};

/** New chat and the saved chats, newest first. Used in the laptop column and the phone sheet. */
function HistoryPanel({ conversations, currentId, locked, now, onNew, onOpen, onDelete }: HistoryProps) {
  const headingId = useId();
  return (
    <div className="flex min-h-0 w-full flex-col gap-3">
      <button type="button" onClick={onNew} disabled={locked} className={cx(toolButtonClass, "self-start")}>
        <StrokeIcon d={PLUS} />
        New chat
      </button>
      <h2 id={headingId} className="px-1 pt-1 text-[.78rem] font-semibold tracking-wide text-muted uppercase">
        Recent chats
      </h2>
      {conversations.length === 0 ? (
        <p className="px-1 text-[.875rem] text-muted">Your chats are saved on this device and show here.</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
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
                    "flex w-full min-w-0 flex-col rounded-xl border-0 py-2 pr-10 pl-3 text-left transition-colors duration-150 disabled:cursor-not-allowed",
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
export function AssistantChat({ firstName, userId }: { firstName: string; userId: string }) {
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

  useEffect(() => {
    if (messages.length > 0 || thinking) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thinking]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
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
      .map((message) => ({ role: message.from, text: message.reply.text.slice(0, MAX_CHARS) }));
    append("buyer", textReply(question));
    setDraft("");
    setThinking(true);
    let reply: AskReply;
    try {
      reply = await askAction(question, history);
    } catch {
      reply = textReply(ASK_COPY.unavailable);
    }
    pending.current = false;
    setThinking(false);
    append("tradelink", reply);
    focusInput();
  }

  const handlersFor = (messageId: number): ReplyHandlers => ({
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
      onNew={startNewChat}
      onOpen={(conversation) => openConversation(conversation.id, conversation.messages)}
      onDelete={deleteConversation}
    />
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 min-[900px]:grid-cols-[232px_minmax(0,1fr)]">
      <aside
        aria-label="Chat history"
        className="sticky top-0 hidden max-h-[calc(100dvh-9rem)] self-start overflow-hidden min-[900px]:flex"
      >
        {historyPanel}
      </aside>
      <HistorySheet sheetRef={sheetRef}>{historyPanel}</HistorySheet>
      <div className={cx(styles.chat, "mx-auto flex w-full max-w-[760px] flex-col")}>
        <div aria-hidden="true" className={styles.glow} />
        <div className="flex items-center justify-between gap-2 min-[900px]:hidden">
          <button type="button" onClick={() => sheetRef.current?.showModal()} className={toolButtonClass}>
            <Icon name="history" size={18} />
            History
          </button>
          <button type="button" onClick={startNewChat} disabled={locked} className={toolButtonClass}>
            <StrokeIcon d={PLUS} />
            New chat
          </button>
        </div>
        <div className="flex min-h-[calc(100dvh-16rem)] flex-col">
          {empty ? (
            <div className="flex flex-1 flex-col justify-center gap-7 py-6">
              <p className="text-[clamp(1.75rem,5vw,2.6rem)] font-semibold leading-tight tracking-tight">
                <span className={styles.gradientText}>{greeting.hello}</span>
                <br />
                <span className="text-muted">{greeting.ask}</span>
              </p>
              <div role="group" aria-label="Suggestions" className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    type="button"
                    onClick={() => void send(suggestion.text)}
                    className={cx(
                      styles.chip,
                      "flex min-h-[104px] flex-col justify-between gap-3 rounded-2xl p-3.5 text-left text-[.92rem] font-medium text-ink",
                    )}
                  >
                    <span>{suggestion.text}</span>
                    <span className="self-end text-accent">
                      <Icon name={suggestion.icon} size={20} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div
            role="log"
            aria-live="polite"
            aria-label="Conversation with Tradelink Assistant"
            className={cx("flex flex-col gap-6", !empty && "py-4")}
          >
            {messages.map((message) => (
              <MessageView key={message.id} message={message} handlers={handlersFor(message.id)} />
            ))}
            {thinking ? (
              <div className="flex items-center gap-3">
                <AssistantAvatar />
                <p className={cx(styles.thinking, "font-medium")}>Thinking...</p>
              </div>
            ) : null}
          </div>
          <div ref={endRef} aria-hidden="true" className="scroll-mb-40" />
        </div>
        <div
          className={cx(
            styles.dock,
            "sticky bottom-0 z-10 pt-6 pb-2 after:absolute after:inset-x-0 after:top-full after:h-9 after:bg-bg",
          )}
        >
          <form
            onSubmit={onSubmit}
            aria-busy={thinking || undefined}
            className={cx(styles.composer, "flex items-end gap-2 rounded-[28px] py-1.5 pr-1.5 pl-5")}
          >
            <label htmlFor={inputId} className="sr-only">
              Message Tradelink Assistant
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_CHARS}
              autoComplete="off"
              enterKeyHint="send"
              placeholder="Type a question or an order"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              className="max-h-[200px] min-w-0 flex-1 resize-none self-center border-0 bg-transparent py-2 text-base leading-6 text-ink outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={thinking || draft.trim() === ""}
              className={cx(
                styles.avatar,
                "grid size-10 flex-none place-items-center rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <SendIcon />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[.75rem] text-muted">Nothing is ordered until you tap Place order.</p>
        </div>
      </div>
    </div>
  );
}
