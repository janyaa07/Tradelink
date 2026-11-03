"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { ASK_COPY, greetingText, textReply } from "@/domain/ask/replies";
import type { AskAction, AskCard, AskReply, AskTurn } from "@/domain/ask/types";
import { formatMoney } from "@/domain/money";
import { loadRestockPlanAction, loadUsualAction } from "@/features/buyer/home-actions";
import { StatusPill } from "@/features/orders/OrderCard";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { controlClass } from "@/ui/Field";
import { formatDate, orderNumber } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { useToast } from "@/ui/Toast";
import { askAction, reviewAskOrderAction } from "./actions";

/** The prototype's suggestion chips (BUY-47.2). */
const SUGGESTIONS = [
  "What should I order?",
  "What's arriving today?",
  "How much did I spend this week?",
  "How much is cooking oil?",
  "Which supplier is most reliable?",
  "2 ctn eggs and 5 tins evaporated milk",
] as const;

const MAX_CHARS = 2000;
const MAX_HISTORY = 20;

type Message = { id: number; from: AskTurn["role"]; reply: AskReply };

const cardClass = "flex w-[min(100%,420px)] flex-col gap-1 rounded-[10px] border border-line bg-surface px-3 py-2.5";
const rowClass = "flex items-center justify-between gap-2.5 text-[.9rem]";
const suggestionClass = cx(
  "inline-flex min-h-8 flex-none items-center rounded-full border border-line bg-surface px-[11px] py-1.5",
  "text-[.84rem] font-semibold text-muted transition-colors duration-150 hover:border-accent",
);

function CardView({ card }: { card: AskCard }) {
  switch (card.kind) {
    case "order": {
      const { order } = card;
      return (
        <div className={cardClass}>
          <div className={rowClass}>
            <b className="font-mono">{orderNumber(order.number)}</b>
            <StatusPill status={order.status} />
          </div>
          <p className="text-[.84rem] text-muted">
            {order.supplierName}
            {order.deliveryDate ? ` · Delivery ${formatDate(order.deliveryDate)}` : null}
          </p>
          <ul className="flex flex-col gap-1">
            {order.lines.map((line, index) => (
              <li key={index} className={rowClass}>
                {line.qty} × {line.name}
              </li>
            ))}
          </ul>
          <p className={rowClass}>
            <span className="text-[.84rem] text-muted">Total</span>
            <b className="num">{formatMoney(order.totalCents)}</b>
          </p>
        </div>
      );
    }
    case "plan":
      return (
        <ul className={cardClass}>
          {card.items.map((item, index) => (
            <li key={index} className={rowClass}>
              <span>{item.name}</span>
              <span className="text-[.84rem] text-muted">{item.daysLeft}</span>
            </li>
          ))}
        </ul>
      );
    case "price":
      return (
        <dl className={cardClass}>
          <div className={rowClass}>
            <dt>Supplier</dt>
            <dd>{card.price.supplierName}</dd>
          </div>
          <div className={rowClass}>
            <dt>Available</dt>
            <dd className="num">{card.price.available}</dd>
          </div>
          {card.price.lastPaid ? (
            <div className={rowClass}>
              <dt>You last paid</dt>
              <dd className="num">{card.price.lastPaid}</dd>
            </div>
          ) : null}
        </dl>
      );
    case "read":
      return (
        <ul className={cardClass}>
          {card.lines.map((line, index) => (
            <li key={index} className={rowClass}>
              <span className="min-w-0 [overflow-wrap:anywhere]">{line.label}</span>
              <span className="flex-none text-[.84rem] text-muted">{line.status}</span>
            </li>
          ))}
        </ul>
      );
  }
}

/** Buttons under a reply. Each one only prepares a draft or opens a page; nothing is sent from Ask. */
function ReplyActions({ actions }: { actions: AskAction[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();

  const toReview = (task: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const result = await task();
      if (result.ok) router.push("/buyer/order");
      else show(result.error);
    });

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        switch (action.kind) {
          case "link":
            return (
              <LinkButton key={action.kind} href={action.href}>
                {action.label}
              </LinkButton>
            );
          case "load_plan":
            return (
              <Button key={action.kind} variant="primary" aria-busy={busy || undefined} disabled={busy} onClick={() => toReview(loadRestockPlanAction)}>
                Review and send
              </Button>
            );
          case "load_usual":
            return (
              <Button key={action.kind} variant="primary" aria-busy={busy || undefined} disabled={busy} onClick={() => toReview(loadUsualAction)}>
                Load my usual
              </Button>
            );
          case "review_order":
            return (
              <Button
                key={action.kind}
                variant="primary"
                aria-busy={busy || undefined}
                disabled={busy}
                onClick={() => toReview(() => reviewAskOrderAction(action.lines))}
              >
                Review order
              </Button>
            );
        }
      })}
    </div>
  );
}

function MessageView({ message }: { message: Message }) {
  if (message.from === "buyer") {
    return (
      <p className="max-w-[82%] self-end whitespace-pre-line rounded-[16px_16px_4px_16px] bg-accent px-3 py-2 text-on-accent [overflow-wrap:anywhere]">
        <span className="sr-only">You: </span>
        {message.reply.text}
      </p>
    );
  }
  const { text, cards, actions } = message.reply;
  return (
    <div className="flex w-full flex-col items-start gap-[7px] self-start">
      <p className="whitespace-pre-line [overflow-wrap:anywhere]">
        <span className="sr-only">Tradelink: </span>
        {text}
      </p>
      {cards.map((card, index) => (
        <CardView key={index} card={card} />
      ))}
      {actions.length > 0 ? <ReplyActions actions={actions} /> : null}
    </div>
  );
}

/** Ask Tradelink chat (BUY-47). The conversation lives in this component for the session only. */
export function AskChat({ firstName }: { firstName: string }) {
  const inputId = useId();
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "tradelink", reply: textReply(greetingText(firstName)) },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(1);
  /** Guards against a second send before the first reply arrives (state updates are async). */
  const pending = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 1 || thinking) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thinking]);

  async function send(text: string) {
    const question = text.trim().slice(0, MAX_CHARS);
    if (question === "" || pending.current) return;
    pending.current = true;
    // The greeting is not history; each earlier turn goes back to the server for context.
    const history: AskTurn[] = messages
      .slice(1)
      .slice(-MAX_HISTORY)
      .map((message) => ({ role: message.from, text: message.reply.text.slice(0, MAX_CHARS) }));
    setMessages((current) => [...current, { id: nextId.current++, from: "buyer", reply: textReply(question) }]);
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
    setMessages((current) => [...current, { id: nextId.current++, from: "tradelink", reply }]);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <>
      <div role="log" aria-live="polite" aria-label="Conversation with Tradelink" className="flex flex-1 flex-col gap-3">
        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}
        {thinking ? <p className="self-start text-muted">Thinking...</p> : null}
      </div>
      <div className="sticky -bottom-7 flex flex-col gap-[7px] bg-bg py-2 rail:-bottom-9">
        <div role="group" aria-label="Suggestions" className="flex gap-1.5 overflow-x-auto pb-0.5">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className={suggestionClass} onClick={() => void send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={onSubmit} aria-busy={thinking || undefined}>
          <label htmlFor={inputId} className="sr-only">
            Message Tradelink
          </label>
          <input
            id={inputId}
            className={cx(controlClass, "flex-1")}
            placeholder="Message Tradelink"
            value={draft}
            maxLength={MAX_CHARS}
            autoComplete="off"
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="primary">
            Send
          </Button>
        </form>
      </div>
      <div ref={endRef} aria-hidden="true" />
    </>
  );
}
