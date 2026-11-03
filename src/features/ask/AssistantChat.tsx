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
import { addedToCartText, ASK_COPY, placeCartLabel, placedText, textReply } from "@/domain/ask/replies";
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
import type { StepTone } from "@/features/home/HomeParts";
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

const SUGGESTIONS: Record<AiRole, { text: string; hint: string; icon: IconName }[]> = {
  buyer: [
    {
      text: "Order my usual",
      hint: "Put your usual items in the cart",
      icon: "repeat",
    },
    {
      text: "What's arriving today?",
      hint: "Deliveries on the way and to check",
      icon: "truck",
    },
    {
      text: "How much did I spend this week?",
      hint: "Spend against your budget",
      icon: "receipt",
    },
    {
      text: "What's in my cart?",
      hint: "Lines, totals and cut-offs",
      icon: "cart",
    },
  ],
  supplier: [
    {
      text: "What new orders do I have?",
      hint: "Accept or reject them",
      icon: "list",
    },
    {
      text: "What's low in stock?",
      hint: "At or below the reorder level",
      icon: "stock",
    },
    {
      text: "Any problems I need to answer?",
      hint: "Credit, replace or reply",
      icon: "flag",
    },
    {
      text: "What goes out for delivery today?",
      hint: "Today's pick list",
      icon: "truck",
    },
  ],
};

const PLACEHOLDER = "Ask anything, or tell me what to do";

const INTRO: Record<AiRole, string> = {
  buyer: "Ask about orders, stock and spend, or tell me what to order. I check with you before anything changes.",
  supplier: "Ask about orders, stock and buyers, or tell me what to do. I check with you before anything changes.",
};

/** Card tags such as [[ORD-1061]], left out when an answer is copied. */
const CARD_TAG = /\[\[[^\]]*\]\]\n?/g;

const FACT_DOTS: Record<StepTone, string> = {
  bad: "bg-bad",
  warn: "bg-[#C98A1A]",
  info: "bg-info",
  good: "bg-good",
};

type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "status"; text: string; done: string }
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
    if (tool === "update_terms")
      return {
        kind: "link",
        label: "Open settings",
        href: "/supplier/settings",
      };
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

const REVIEW_CART: AskAction = {
  kind: "link",
  label: "Review cart",
  href: "/buyer/cart",
};

const STATUS_TONES: Record<ReadLineStatus, PillTone> = {
  Matched: "good",
  "Check this": "warn",
  "Not found": "bad",
};

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
  /** Resolves true when the change went through. */
  onConfirm: (proposal: AiProposal) => Promise<boolean>;
  onSkip: (proposal: AiProposal) => void;
};

/** A change Tradelink AI wants to make. Nothing happens until the person taps the button. */
function ConfirmCard({ proposal, state, handlers }: { proposal: AiProposal; state: "done" | "skipped" | undefined; handlers: ReplyHandlers }) {
  const [busy, start] = useTransition();
  return (
    <div
      className={cx(
        "w-full max-w-[560px] overflow-hidden rounded-xl",
        state === "done" ? "border border-good/40 bg-surface" : state === "skipped" ? "border border-line bg-surface opacity-70" : "ai-ring",
      )}
    >
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[.75rem] font-semibold">
            {state === "done" ? (
              <span className="flex items-center gap-1 text-good">
                <Icon name="check" size={14} />
                Done
              </span>
            ) : state === "skipped" ? (
              <span className="text-muted">Not now</span>
            ) : (
              <>
                <span aria-hidden="true" className="ai-spark size-3.5" />
                <span className="ai-text">Needs your OK</span>
              </>
            )}
          </p>
          <b className="block leading-snug [overflow-wrap:anywhere]">{proposal.title}</b>
        </div>
      </div>
      {proposal.details.length > 0 ? (
        <ul className="mx-3.5 mt-2 flex flex-col gap-0.5 rounded-lg bg-sunken px-3 py-2 text-[.85rem]">
          {proposal.details.map((detail, index) => (
            <li key={index} className="[overflow-wrap:anywhere]">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
      {state ? (
        <div className="h-3" />
      ) : (
        <div className="flex flex-wrap gap-2 px-3.5 pt-3 pb-3.5">
          <Button
            variant="primary"
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={() =>
              start(async () => {
                await handlers.onConfirm(proposal);
              })
            }
          >
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

/** Several changes in one answer: one card with numbered steps, run in order with one tap. */
function ConfirmGroup({
  proposals,
  resolved,
  handlers,
}: {
  proposals: AiProposal[];
  resolved: Record<string, "done" | "skipped">;
  handlers: ReplyHandlers;
}) {
  const [busy, start] = useTransition();
  const open = proposals.filter((proposal) => !resolved[proposal.id]);
  return (
    <div className={cx("w-full max-w-[560px] overflow-hidden rounded-xl px-3.5 py-3", open.length > 0 ? "ai-ring" : "border border-line bg-surface")}>
      <p className="flex items-center gap-1.5 text-[.75rem] font-semibold">
        <span aria-hidden="true" className="ai-spark size-3.5" />
        <span className="ai-text">{open.length > 0 ? "Needs your OK" : "All done"}</span>
      </p>
      <ol className="mt-2.5 flex flex-col gap-2">
        {proposals.map((proposal, index) => {
          const state = resolved[proposal.id];
          return (
            <li key={proposal.id} className="flex items-start gap-2.5 text-[.875rem]">
              <span
                className={cx(
                  "grid size-[22px] flex-none place-items-center rounded-full text-[.72rem] font-semibold tabular-nums",
                  state === "done" ? "bg-good-soft text-good" : "bg-sunken text-ink",
                )}
              >
                {state === "done" ? <Icon name="check" size={13} /> : index + 1}
              </span>
              <span className={cx("min-w-0 flex-1", state === "skipped" && "text-muted line-through")}>
                <b className="font-semibold">{proposal.title}</b>
                {proposal.details[0] ? <span className="text-muted"> · {proposal.details[0]}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {open.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={() =>
              start(async () => {
                for (const proposal of open) {
                  if (!(await handlers.onConfirm(proposal))) break;
                }
              })
            }
          >
            {busy ? "Working..." : open.length === 2 ? "Do both" : `Do all ${open.length}`}
          </Button>
          <Button disabled={busy} onClick={() => open.forEach((proposal) => handlers.onSkip(proposal))}>
            Not now
          </Button>
        </div>
      ) : null}
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
  const confirms = actions.flatMap((action) => (action.kind === "confirm" ? [action.proposal] : []));
  const grouped = confirms.length > 1;
  return (
    <div className="flex w-full flex-wrap gap-2">
      {grouped ? <ConfirmGroup proposals={confirms} resolved={resolved} handlers={handlers} /> : null}
      {actions.map((action) => {
        switch (action.kind) {
          case "confirm":
            if (grouped) return null;
            return <ConfirmCard key={action.proposal.id} proposal={action.proposal} state={resolved[action.proposal.id]} handlers={handlers} />;
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
  onRetry,
}: {
  message: ChatMessage;
  handlers: ReplyHandlers;
  streaming: boolean;
  onAsk: ((text: string) => void) | null;
  onCard: (card: AiCard) => void;
  /** Ask the question behind this answer again; the last answer only. */
  onRetry: (() => void) | null;
  /** The rotating line shown while Tradelink AI works, inside this reply so there is one avatar. */
  waiting: ReactNode;
}) {
  const { blocks, asks } = parseReply(message.reply.text, streaming);
  const cards = new Map(message.reply.cards.filter((card): card is AiCard => card.kind.startsWith("ai_")).map((card) => [card.key, card]));
  const [copied, setCopied] = useState(false);
  const steps = message.steps ?? [];
  const trail =
    steps.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5" aria-label="What Tradelink AI checked">
        <span className="mr-0.5 text-[.75rem] text-muted">
          {streaming || message.workedMs === undefined ? "Working" : `Worked for ${Math.max(1, Math.round(message.workedMs / 1000))}s`}
        </span>
        {steps.map((step) => (
          <span key={step} className="inline-flex h-6 items-center gap-1 rounded-full bg-sunken px-2.5 text-[.75rem] font-medium text-ink/80">
            <Icon name="check" size={12} className="text-good" />
            {step}
          </span>
        ))}
      </div>
    ) : null;
  if (blocks.length === 0 && message.reply.actions.length === 0) {
    return waiting ? (
      <div className="flex gap-3">
        <AssistantAvatar />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pt-1">
          {trail}
          {waiting}
        </div>
      </div>
    ) : null;
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainReply(message.reply.text).replace(CARD_TAG, "").trim());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 pt-1">
        <span className="sr-only">Tradelink AI: </span>
        {trail}
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
              <ul key={index} className="flex list-disc flex-col gap-1 pl-5 leading-relaxed marker:text-[var(--ai-2)]">
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
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[.82rem] font-medium text-ink transition-colors duration-150 hover:border-[var(--ai-2)] hover:text-accent"
              >
                <span aria-hidden="true" className="ai-spark size-3" />
                {ask}
              </button>
            ))}
          </div>
        ) : null}
        {!streaming && message.reply.text.trim() ? (
          <div className="-ml-1.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={copied ? "Copied" : "Copy answer"}
              title={copied ? "Copied" : "Copy answer"}
              className="grid size-7 place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-sunken hover:text-ink"
            >
              <Icon name={copied ? "check" : "copy"} size={15} />
            </button>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                aria-label="Ask again"
                title="Ask again"
                className="grid size-7 place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-sunken hover:text-ink"
              >
                <Icon name="repeat" size={15} />
              </button>
            ) : null}
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
        {actions.length > 0 ? <ReplyActions actions={actions} done={message.done} resolved={message.resolved ?? {}} handlers={handlers} /> : null}
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

/** New chat, a search and the saved chats grouped by day. Used in the laptop column and the phone sheet. */
function HistoryPanel({ conversations, currentId, locked, now, onNew, onOpen, onDelete }: HistoryProps) {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const shown = words ? conversations.filter((conversation) => conversation.title.toLowerCase().includes(words)) : conversations;
  const groups = new Map<string, Conversation[]>();
  for (const conversation of shown) {
    const day = relativeDay(conversation.updatedAt, now);
    const label = day === "Today" || day === "Yesterday" ? day : "Earlier";
    groups.set(label, [...(groups.get(label) ?? []), conversation]);
  }
  return (
    <div className="flex min-h-0 w-full flex-col gap-2">
      <button
        type="button"
        onClick={onNew}
        disabled={locked}
        className="ai-ring flex h-10 items-center gap-2 rounded-xl px-3 text-[.875rem] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true" className="ai-spark size-4" />
        New chat
      </button>
      <label className="flex h-9 items-center gap-2 rounded-lg bg-sunken px-2.5 text-muted">
        <Icon name="search" size={15} />
        <span className="sr-only">Search chats</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          className="min-w-0 flex-1 border-0 bg-transparent text-[.84rem] text-ink outline-none placeholder:text-muted"
        />
      </label>
      {conversations.length === 0 ? (
        <p className="px-1 pt-2 text-[.84rem] text-muted">Your chats are saved on this device and show here.</p>
      ) : shown.length === 0 ? (
        <p className="px-1 pt-2 text-[.84rem] text-muted">No chats match.</p>
      ) : (
        <div className="-mx-1 flex min-h-0 flex-col overflow-y-auto">
          {[...groups].map(([label, items]) => (
            <section key={label} aria-label={label}>
              <h2 className="px-2 pt-3 pb-1 text-[.72rem] font-semibold text-muted">{label}</h2>
              <ul className="flex flex-col gap-0.5">
                {items.map((conversation) => {
                  const current = conversation.id === currentId;
                  return (
                    <li key={conversation.id} className="relative">
                      <button
                        type="button"
                        onClick={() => onOpen(conversation)}
                        disabled={locked}
                        aria-current={current ? "true" : undefined}
                        className={cx(
                          "flex w-full min-w-0 rounded-md border-0 py-1.5 pr-9 pl-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed",
                          current ? "bg-sunken font-semibold text-ink" : "bg-transparent text-ink/85 hover:bg-sunken",
                        )}
                      >
                        <span className="truncate text-[.84rem]">{conversation.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(conversation)}
                        disabled={locked}
                        aria-label={`Delete chat: ${conversation.title}`}
                        title="Delete chat"
                        className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent text-muted opacity-60 hover:bg-surface hover:text-bad hover:opacity-100 disabled:cursor-not-allowed"
                      >
                        <StrokeIcon d={CLOSE} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
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
  /** "Good evening, Siti", worked out on the server so it matches the person's clock. */
  hello: string;
  userId: string;
  role?: AiRole;
  /** A question asked from Home (?q=&t=), sent as soon as the chat opens. */
  initialQuestion?: { text: string; stamp: string };
  /** What needs the person right now, shown on a new chat (the same list as Home's Next up). */
  facts: { tone: StepTone; text: string }[];
};

export function AssistantChat({ hello, userId, role = "buyer", initialQuestion, facts }: AssistantChatProps) {
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

  const append = (from: ChatMessage["from"], reply: AskReply) => commit([...messagesRef.current, { id: nextId.current++, from, reply, done: false }]);

  /** Streaming updates to the reply being written: shown at once, saved when the reply ends. */
  const patch = (messageId: number, change: (message: ChatMessage) => ChatMessage) => {
    messagesRef.current = messagesRef.current.map((message) => (message.id === messageId ? change(message) : message));
    setMessages(messagesRef.current);
  };

  const resolve = (messageId: number, proposalId: string, state: "done" | "skipped") =>
    commit(
      messagesRef.current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              resolved: { ...message.resolved, [proposalId]: state },
            }
          : message,
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
    const history: AskTurn[] = messagesRef.current.slice(-MAX_HISTORY).map((message) => ({
      role: message.from,
      text: (message.ai ? plainReply(message.reply.text) : message.reply.text).slice(0, MAX_CHARS),
    }));
    append("buyer", textReply(question));
    setDraft("");
    setThinking(true);
    setStatus(null);
    setWaitStep(0);
    lastTextAt.current = 0;
    const replyId = nextId.current++;
    commit([
      ...messagesRef.current,
      {
        id: replyId,
        ai: true,
        from: "tradelink",
        reply: { text: "", cards: [], actions: [] },
        done: false,
      },
    ]);
    let newParagraph = false;
    const started = Date.now();
    const held: AskAction[] = [];
    const addText = (text: string) => {
      lastTextAt.current = Date.now();
      const joiner = newParagraph ? "\n\n" : "";
      patch(replyId, (message) => ({
        ...message,
        reply: { ...message.reply, text: message.reply.text + joiner + text },
      }));
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
            patch(replyId, (message) => {
              const steps = message.steps ?? [];
              return steps.includes(event.done) ? message : { ...message, steps: [...steps, event.done].slice(0, 12) };
            });
          } else if (event.type === "break") newParagraph = true;
          else if (event.type === "error") addText(event.message);
          else if (event.type === "cards") {
            // Ready for the answer to place; only the cards it tags are drawn.
            patch(replyId, (message) => ({
              ...message,
              reply: {
                ...message.reply,
                cards: [...message.reply.cards, ...event.cards],
              },
            }));
          } else if (event.type === "proposal") held.push({ kind: "confirm", proposal: event.proposal });
        }
      }
    } catch {
      addText(ASK_COPY.unavailable);
    }
    // Confirm cards follow the answer, so nothing jumps while it is written.
    if (held.length > 0)
      patch(replyId, (message) => ({
        ...message,
        reply: {
          ...message.reply,
          actions: [...message.reply.actions, ...held],
        },
      }));
    patch(replyId, (message) => (message.steps ? { ...message, workedMs: Date.now() - started } : message));
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
        result = await executeAiAction({
          id: proposal.id,
          tool: proposal.tool,
          args: proposal.args,
        });
      } catch {
        result = { ok: false, error: ASK_COPY.unavailable };
      }
      setWorking(false);
      if (!result.ok) {
        append("tradelink", textReply(result.error));
        return false;
      }
      resolve(messageId, proposal.id, "done");
      const link = linkAfter(role, proposal.tool);
      append("tradelink", {
        text: result.data,
        cards: [],
        actions: link ? [link] : [],
      });
      router.refresh();
      return true;
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
        append("tradelink", {
          text: result.error,
          cards: [],
          actions: [REVIEW_CART],
        });
        return;
      }
      markDone(messageId);
      append("tradelink", {
        text: placedText(
          result.data.orders.map((order) => ({
            number: orderNumber(order.number),
            supplierName: order.supplierName,
          })),
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
  const current = conversations.find((conversation) => conversation.id === currentId);
  const title = current?.title ?? messages.find((message) => !message.ai)?.reply.text ?? "New chat";
  const historyPanel = (
    <HistoryPanel
      conversations={conversations}
      currentId={currentId}
      locked={locked}
      now={now}
      onNew={() => {
        sheetRef.current?.close();
        startNewChat();
      }}
      onOpen={(conversation) => {
        sheetRef.current?.close();
        openConversation(conversation.id, conversation.messages);
      }}
      onDelete={deleteConversation}
    />
  );
  const composer = (
    <form
      onSubmit={onSubmit}
      aria-busy={thinking || undefined}
      className={cx("ai-ring flex flex-col gap-1.5 rounded-2xl", empty ? "px-4 pt-3 pb-2.5" : "px-3.5 pt-2 pb-2")}
    >
      <label htmlFor={inputId} className="sr-only">
        Message Tradelink AI
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        rows={empty ? 2 : 1}
        value={draft}
        maxLength={MAX_CHARS}
        autoComplete="off"
        enterKeyHint="send"
        placeholder={PLACEHOLDER}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        className="max-h-[200px] min-w-0 resize-none border-0 bg-transparent py-1 text-[.95rem] leading-6 text-ink outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-2">
        <span className="hidden text-[.72rem] text-muted rail:inline">Tradelink AI checks with you before it changes anything</span>
        <span className="flex-1" />
        <span className="hidden text-[.72rem] text-muted rail:inline">Enter to send</span>
        <button
          type="submit"
          aria-label="Send message"
          disabled={thinking || draft.trim() === ""}
          className="ai-fill grid size-9 flex-none place-items-center rounded-[10px] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );

  return (
    <div
      data-fill
      className="grid h-full grid-cols-[minmax(0,1fr)] overflow-hidden bg-surface rail:rounded-lg rail:border rail:border-line rail:shadow-card min-[900px]:grid-cols-[248px_minmax(0,1fr)]"
    >
      <aside aria-label="Chats" className="hidden min-h-0 border-r border-line p-3 min-[900px]:flex">
        {historyPanel}
      </aside>
      <HistorySheet sheetRef={sheetRef}>{historyPanel}</HistorySheet>
      <section aria-label="Chat" className="flex min-h-0 min-w-0 flex-col">
        <div className={cx("flex h-12 flex-none items-center gap-2 border-b border-line px-3.5 rail:px-5", empty && "min-[900px]:hidden")}>
          <Button size="small" onClick={() => sheetRef.current?.showModal()} className="min-[900px]:hidden" aria-label="Chats">
            <Icon name="history" size={16} />
          </Button>
          {empty ? (
            <p className="ai-text font-semibold">Tradelink AI</p>
          ) : (
            <h1 className="min-w-0 truncate text-[.92rem] font-semibold">
              {title}
              {current ? <span className="font-normal text-muted"> · {relativeDay(current.updatedAt, now)}</span> : null}
            </h1>
          )}
          <span className="flex-1" />
          {empty ? null : (
            <Button size="small" onClick={startNewChat} disabled={locked}>
              <StrokeIcon d={PLUS} />
              New chat
            </Button>
          )}
        </div>
        {empty ? (
          <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-10 pb-8 rail:px-8 rail:pt-16">
            <div aria-hidden="true" className="ai-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
            <div className="relative flex w-full max-w-[720px] flex-col gap-5">
              <div className="flex flex-col items-center gap-2.5 text-center">
                <span aria-hidden="true" className="ai-spark size-9" />
                <h1 className="ai-text text-[1.6rem] font-semibold tracking-[-0.025em] rail:text-[1.85rem]">{hello}</h1>
                <p className="max-w-[520px] text-[.92rem] text-muted">{INTRO[role]}</p>
              </div>
              {composer}
              <div role="group" aria-label="Suggestions" className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-2">
                {SUGGESTIONS[role].map((suggestion) => (
                  <button
                    key={suggestion.text}
                    type="button"
                    onClick={() => void send(suggestion.text)}
                    className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left text-ink transition-colors duration-150 hover:border-[var(--ai-2)]"
                  >
                    <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-sunken text-ink/80">
                      <Icon name={suggestion.icon} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[.85rem] font-semibold">{suggestion.text}</b>
                      <span className="text-[.8rem] text-muted">{suggestion.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              {facts.length > 0 ? (
                <section aria-label="What Tradelink AI can see" className="ai-tint flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3">
                  <span className="ai-text text-[.75rem] font-semibold">What I can see right now</span>
                  {facts.map((fact) => (
                    <span key={fact.text} className="flex items-center gap-2 text-[.8rem] text-ink/80">
                      <span aria-hidden="true" className={cx("size-[7px] flex-none rounded-full", FACT_DOTS[fact.tone])} />
                      {fact.text}
                    </span>
                  ))}
                </section>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-6 rail:px-8">
              <div
                role="log"
                aria-live="polite"
                aria-label="Conversation with Tradelink AI"
                className="mx-auto flex w-full max-w-[720px] flex-col gap-6 pb-4"
              >
                {messages.map((message, index) => {
                  const last = index === messages.length - 1;
                  const question = messages[index - 1];
                  return message.ai ? (
                    <AiReply
                      key={message.id}
                      message={message}
                      handlers={handlersFor(message.id)}
                      streaming={thinking && last}
                      onAsk={!thinking && last ? (ask) => void send(ask) : null}
                      onCard={(card) => updateCard(message.id, card)}
                      onRetry={!thinking && last && question && !question.ai ? () => void send(question.reply.text) : null}
                      waiting={
                        thinking && last && Date.now() - lastTextAt.current > QUIET_AFTER_TEXT_MS ? (
                          <p key={`${status ?? ""}${waitStep}`} aria-live="polite" className={cx(styles.thinking, styles.waitLine, "font-medium")}>
                            {status && waitStep === 0 ? status : WAITING[role][waitStep % WAITING[role].length]}
                            ...
                          </p>
                        ) : null
                      }
                    />
                  ) : (
                    <MessageView key={message.id} message={message} handlers={handlersFor(message.id)} />
                  );
                })}
              </div>
              <div ref={endRef} aria-hidden="true" className="scroll-mb-6" />
            </div>
            <div className="flex-none px-3.5 pt-2 pb-3 rail:px-8 rail:pb-4">
              <div className="mx-auto w-full max-w-[720px]">{composer}</div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
