"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { addedToCartText, ASK_COPY, greetingText, textReply } from "@/domain/ask/replies";
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
import { addToCartAction, askAction } from "./actions";

const SUGGESTIONS: { text: string; icon: IconName }[] = [
  { text: "Order my usual", icon: "repeat" },
  { text: "What's arriving today?", icon: "truck" },
  { text: "How much did I spend this week?", icon: "receipt" },
  { text: "What should I reorder?", icon: "stock" },
];

const MAX_CHARS = 2000;
const MAX_HISTORY = 20;
const MAX_INPUT_HEIGHT = 200;

type Message = { id: number; from: AskTurn["role"]; reply: AskReply; added: boolean };

const STATUS_TONES: Record<ReadLineStatus, PillTone> = { Matched: "good", "Check this": "warn", "Not found": "bad" };

const cardClass = "flex w-full max-w-[480px] flex-col rounded-xl border border-line bg-surface";
const rowClass = "flex items-center justify-between gap-3 px-3.5 py-2.5 text-[.92rem]";

function AssistantAvatar() {
  return (
    <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-accent-soft text-accent">
      <svg viewBox="0 0 24 24" className="size-[18px]" focusable="false">
        <path d="M12 2c.6 4.8 3.2 7.4 8 8-4.8.6-7.4 3.2-8 8-.6-4.8-3.2-7.4-8-8 4.8-.6 7.4-3.2 8-8z" fill="currentColor" />
      </svg>
    </span>
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

/** Buttons under a reply. Add to cart only fills the cart; orders are placed from the cart. */
function ReplyActions({ actions, added, onAdd }: { actions: AskAction[]; added: boolean; onAdd: (lines: CartLine[]) => Promise<void> }) {
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
                disabled={busy || added}
                onClick={() => start(() => onAdd(action.lines))}
              >
                {added ? "Added to cart" : busy ? "Adding..." : "Add to cart"}
              </Button>
            );
        }
      })}
    </div>
  );
}

function MessageView({ message, onAdd }: { message: Message; onAdd: (lines: CartLine[]) => Promise<void> }) {
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
        {actions.length > 0 ? <ReplyActions actions={actions} added={message.added} onAdd={onAdd} /> : null}
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
      <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tradelink Assistant chat (BUY-47). The conversation lives in this component for the session only. */
export function AssistantChat({ firstName }: { firstName: string }) {
  const router = useRouter();
  const inputId = useId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(1);
  /** Guards against a second send before the first reply arrives (state updates are async). */
  const pending = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0 || thinking) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thinking]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [draft]);

  const append = (from: Message["from"], reply: AskReply) =>
    setMessages((current) => [...current, { id: nextId.current++, from, reply, added: false }]);

  async function send(text: string) {
    const question = text.trim().slice(0, MAX_CHARS);
    if (question === "" || pending.current) return;
    pending.current = true;
    const history: AskTurn[] = messages
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
  }

  const addToCart = (messageId: number) => async (lines: CartLine[]) => {
    let result: Awaited<ReturnType<typeof addToCartAction>>;
    try {
      result = await addToCartAction(lines);
    } catch {
      result = { ok: false, error: ASK_COPY.unavailable };
    }
    if (!result.ok) {
      append("tradelink", textReply(result.error));
      return;
    }
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, added: true } : message)));
    append("tradelink", {
      text: addedToCartText(result.data.added),
      cards: [],
      actions: [{ kind: "link", label: "View cart", href: "/buyer/cart" }],
    });
    router.refresh();
  };

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

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col">
      <div className="flex min-h-[calc(100dvh-15rem)] flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col justify-center gap-7 py-6">
            <p className="text-[clamp(1.6rem,5vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink">
              {greetingText(firstName)}
            </p>
            <div role="group" aria-label="Suggestions" className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.text}
                  type="button"
                  onClick={() => void send(suggestion.text)}
                  className={cx(
                    "flex min-h-[104px] flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left",
                    "text-[.92rem] font-medium text-ink transition-colors duration-150 hover:border-accent hover:bg-sunken",
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
            <MessageView key={message.id} message={message} onAdd={addToCart(message.id)} />
          ))}
          {thinking ? (
            <div className="flex items-center gap-3">
              <AssistantAvatar />
              <p className="text-muted motion-safe:animate-pulse">Thinking...</p>
            </div>
          ) : null}
        </div>
        <div ref={endRef} aria-hidden="true" className="scroll-mb-40" />
      </div>
      <div className="sticky bottom-0 z-10 bg-bg pt-2 pb-2 after:absolute after:inset-x-0 after:top-full after:h-9 after:bg-bg">
        <form
          onSubmit={onSubmit}
          aria-busy={thinking || undefined}
          className="flex items-end gap-2 rounded-[28px] border border-control-line bg-surface py-1.5 pr-1.5 pl-5 shadow-card focus-within:border-accent"
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
            className="grid size-10 flex-none place-items-center rounded-full bg-accent text-on-accent transition-colors disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted"
          >
            <SendIcon />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[.75rem] text-muted">Nothing is ordered until you place it from your cart.</p>
      </div>
    </div>
  );
}
