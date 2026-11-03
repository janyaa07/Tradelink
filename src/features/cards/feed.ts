import { z } from "zod";
import { cardFromRow, type CardEnvelope } from "@/cards/envelope";

/** A thread's messages and the cards they carry, merged from the first load, Realtime and taps. */
export type FeedMessage = {
  id: string;
  authorKind: string;
  body: string;
  cardId: string | null;
  createdAt: string;
  /** A card shown straight from a tap's response, before its chat message arrives. */
  local?: boolean;
};

export type FeedState = { messages: FeedMessage[]; cards: Record<string, CardEnvelope> };

export const EMPTY_FEED: FeedState = { messages: [], cards: {} };

export type FeedAction =
  | { type: "load"; messages: FeedMessage[]; cards: CardEnvelope[] }
  | { type: "message"; message: FeedMessage }
  | { type: "card"; card: CardEnvelope; threadId: string };

const MessageRowSchema = z.object({
  id: z.string(),
  author_kind: z.string(),
  body: z.string(),
  card_id: z.string().nullable(),
  created_at: z.string(),
  card: z.unknown().optional(),
});

export function messageFromRow(row: unknown): { message: FeedMessage; card: CardEnvelope | null } | null {
  const parsed = MessageRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    message: { id: r.id, authorKind: r.author_kind, body: r.body, cardId: r.card_id, createdAt: r.created_at },
    card: r.card ? cardFromRow(r.card) : null,
  };
}

const time = (iso: string) => Date.parse(iso) || 0;
const byTime = (a: FeedMessage, b: FeedMessage) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id);

function addMessage(messages: FeedMessage[], message: FeedMessage): FeedMessage[] {
  if (messages.some((existing) => existing.id === message.id)) return messages;
  // The real message for a card shown from a tap replaces its local stand-in.
  const rest = message.cardId ? messages.filter((existing) => !(existing.local && existing.cardId === message.cardId)) : messages;
  return [...rest, message].sort(byTime);
}

const sameSubject = (a: CardEnvelope, b: CardEnvelope) =>
  a.type === b.type && a.subject.kind === b.subject.kind && a.subject.id === b.subject.id;

function addCard(state: FeedState, card: CardEnvelope, threadId: string | null): FeedState {
  const existing = state.cards[card.id];
  if (existing && time(existing.updatedAt) > time(card.updatedAt)) return state;
  const cards: Record<string, CardEnvelope> = { ...state.cards, [card.id]: card };

  // A newer card for the same subject replaces older ones at once, without waiting for Realtime.
  if (card.supersededBy === null && card.state !== "superseded") {
    for (const other of Object.values(state.cards)) {
      if (other.id !== card.id && sameSubject(other, card) && other.supersededBy === null && other.subject.version <= card.subject.version && time(other.createdAt) <= time(card.createdAt)) {
        cards[other.id] = { ...other, state: "superseded", supersededBy: card.id };
      }
    }
  }

  let messages = state.messages;
  const shown = messages.some((message) => message.cardId === card.id);
  if (!shown && threadId !== null && card.threadId === threadId && card.supersededBy === null) {
    messages = addMessage(messages, { id: `local:${card.id}`, authorKind: "agent", body: "", cardId: card.id, createdAt: card.createdAt, local: true });
  }
  return { messages, cards };
}

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "load": {
      let next = state;
      for (const card of action.cards) next = addCard(next, card, null);
      let messages = next.messages;
      for (const message of action.messages) messages = addMessage(messages, message);
      return { ...next, messages };
    }
    case "message": {
      const messages = addMessage(state.messages, action.message);
      return messages === state.messages ? state : { ...state, messages };
    }
    case "card":
      return addCard(state, action.card, action.threadId);
  }
}
