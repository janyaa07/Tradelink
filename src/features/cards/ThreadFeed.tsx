"use client";

import { CardRenderer } from "@/cards/CardRenderer";
import { cx } from "@/ui/cx";
import { useThreadFeed, type FeedItem } from "./useThreadFeed";

const PEOPLE = new Set(["owner", "staff", "supplier", "ops"]);

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1].map((n) => (
        <div key={n} className="h-40 animate-pulse rounded-xl border border-line bg-sunken" />
      ))}
    </div>
  );
}

function MessageBubble({ item }: { item: FeedItem }) {
  const mine = PEOPLE.has(item.message.authorKind);
  if (!item.message.body.trim()) return null;
  return (
    <p
      className={cx(
        "max-w-[85%] rounded-xl px-3.5 py-2 text-[.95rem] [overflow-wrap:anywhere]",
        mine ? "self-end bg-accent text-on-accent" : "self-start border border-line bg-surface",
      )}
    >
      {item.message.body}
    </p>
  );
}

/** The shop chat thread with its cards, live across devices. */
export function ThreadFeed({ threadId }: { threadId: string }) {
  const { items, status, upsertCard } = useThreadFeed(threadId);
  if (status === "loading") return <Skeleton />;
  if (status === "error") return <p className="text-muted">The chat could not be loaded. Refresh to try again.</p>;
  if (items.length === 0) return <p className="text-muted">No messages yet. Cards from Tradelink AI will show here.</p>;
  return (
    <ol className="flex flex-col gap-3" aria-label="Chat">
      {items.map((item) => (
        <li key={item.message.id} className="flex flex-col">
          {item.card ? <CardRenderer card={item.card} onUpdate={upsertCard} /> : <MessageBubble item={item} />}
        </li>
      ))}
    </ol>
  );
}
