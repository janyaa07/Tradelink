import { describe, expect, it } from "vitest";
import { card, cardRow, ORDER, THREAD } from "@/cards/testing/fixtures";
import { EMPTY_FEED, feedReducer, messageFromRow, type FeedState } from "./feed";

const V2 = card({ id: "00000000-0000-4000-a100-000000000001" });
const V3 = card({
  id: "00000000-0000-4000-a100-000000000002",
  subject: { kind: "shop_order", id: ORDER, version: 3 },
  createdAt: "2026-11-03T08:01:00Z",
  updatedAt: "2026-11-03T08:01:00Z",
});

const message = (id: string, cardId: string | null, createdAt: string) => ({ id, authorKind: "agent", body: "", cardId, createdAt });

function loaded(): FeedState {
  return feedReducer(EMPTY_FEED, { type: "load", messages: [message("m1", V2.id, V2.createdAt)], cards: [V2] });
}

describe("feedReducer", () => {
  it("reads a message row with its joined card", () => {
    const parsed = messageFromRow({ id: "m1", author_kind: "agent", body: "", card_id: V2.id, created_at: V2.createdAt, card: cardRow() });
    expect(parsed?.card?.id).toBe(V2.id);
    expect(messageFromRow({ id: 1 })).toBeNull();
  });

  it("marks older cards for the same subject superseded as soon as the newer one arrives", () => {
    const state = feedReducer(loaded(), { type: "card", card: V3, threadId: THREAD });
    expect(state.cards[V2.id]).toMatchObject({ state: "superseded", supersededBy: V3.id });
    expect(state.cards[V3.id]?.state).toBe("awaiting_confirm");
  });

  it("shows a card from a tap at once and swaps in its chat message when it arrives", () => {
    const shown = feedReducer(loaded(), { type: "card", card: V3, threadId: THREAD });
    expect(shown.messages.map((m) => m.id)).toEqual(["m1", `local:${V3.id}`]);
    const real = feedReducer(shown, { type: "message", message: message("m2", V3.id, V3.createdAt) });
    expect(real.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(feedReducer(real, { type: "message", message: message("m2", V3.id, V3.createdAt) })).toBe(real);
  });

  it("applies an in-place update and ignores an older copy", () => {
    const answered = { ...V2, state: "done" as const, updatedAt: "2026-11-03T08:02:00Z" };
    const state = feedReducer(loaded(), { type: "card", card: answered, threadId: THREAD });
    expect(state.cards[V2.id]?.state).toBe("done");
    expect(feedReducer(state, { type: "card", card: V2, threadId: THREAD })).toBe(state);
  });

  it("keeps Realtime events that arrived before the first load", () => {
    const early = feedReducer(EMPTY_FEED, { type: "message", message: message("m2", null, "2026-11-03T09:00:00Z") });
    const state = feedReducer(early, { type: "load", messages: [message("m1", V2.id, V2.createdAt)], cards: [V2] });
    expect(state.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});
