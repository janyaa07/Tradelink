import { describe, expect, it } from "vitest";
import { canUndo } from "./agent_action_notice/definition";
import { CardEnvelopeSchema, CardQuestionSchema, cardFromRow, isCardStale } from "./envelope";
import { CardError } from "./errors";
import { orderSummaryCard } from "./order_summary/definition";
import { summarizeOrder } from "./order_summary/summary";
import { questionCard } from "./question/definition";
import { CARD_REGISTRY, getCardDefinition } from "./registry";
import { card, cardRow, LINES, ORDER } from "./testing/fixtures";

const NOW = new Date("2026-11-03T08:00:00Z");

describe("card envelope", () => {
  it("maps a stored row to the envelope", () => {
    const parsed = cardFromRow(cardRow());
    expect(parsed).toMatchObject({ type: "order_summary", subject: { kind: "shop_order", version: 2 }, state: "awaiting_confirm" });
    expect(CardEnvelopeSchema.safeParse(parsed).success).toBe(true);
  });

  it("rejects rows with an unknown state, type or action style", () => {
    expect(cardFromRow(cardRow({ state: "cancelled" }))).toBeNull();
    expect(cardFromRow(cardRow({ type: "made_up" }))).toBeNull();
    expect(cardFromRow(cardRow({ actions: [{ id: "confirm", label: "Go", style: "loud", enabled: true }] }))).toBeNull();
    expect(cardFromRow({ id: "x" })).toBeNull();
  });

  it("knows a superseded or expired card is stale", () => {
    expect(isCardStale(card(), NOW)).toBe(false);
    expect(isCardStale(card({ state: "superseded" }), NOW)).toBe(true);
    expect(isCardStale(card({ supersededBy: LINES[0] }), NOW)).toBe(true);
    expect(isCardStale(card({ expiresAt: "2026-11-03T07:59:59Z" }), NOW)).toBe(true);
    expect(isCardStale(card({ expiresAt: "2026-11-03T08:05:00Z" }), NOW)).toBe(false);
  });

  it("allows 2 to 4 distinct options in a question", () => {
    const option = (id: string) => ({ id, label: id });
    expect(CardQuestionSchema.safeParse({ text: "Which?", options: [option("a"), option("b")] }).success).toBe(true);
    expect(CardQuestionSchema.safeParse({ text: "Which?", options: [option("a")] }).success).toBe(false);
    expect(CardQuestionSchema.safeParse({ text: "Which?", options: [option("a"), option("a")] }).success).toBe(false);
  });
});

describe("card registry", () => {
  it("has a definition for every type and refuses unknown types", () => {
    expect(Object.keys(CARD_REGISTRY).sort()).toEqual(["agent_action_notice", "order_summary", "question"]);
    expect(getCardDefinition("order_summary")).toBe(orderSummaryCard);
    expect(() => getCardDefinition("invoice")).toThrow(CardError);
  });

  it("enables Confirm only when the order awaits confirmation and every line is picked", () => {
    const hydrated = (state: "draft" | "awaiting_confirm" | "confirmed", needsPick = 0) => ({
      data: summarizeOrder({
        orderId: ORDER,
        orderState: "AWAITING_CONFIRM",
        createdAt: NOW.toISOString(),
        lines: [
          { lineId: LINES[0], position: 1, rawText: needsPick ? "taugeh" : "", qty: 1, status: "OPEN", priceCents: 100, deliveryDate: null,
            item: needsPick ? null : { name: "Eggs", orderUnit: "tray", billingType: "fixed", supplierId: null } },
        ],
        suppliers: [],
        purchaseOrders: [],
      }),
      state,
      subjectVersion: 2,
      audience: "shop" as const,
      supplierId: null,
      expiresAt: null,
    });
    const enabled = (state: Parameters<typeof hydrated>[0], needs = 0) =>
      orderSummaryCard.actions(hydrated(state, needs), null, NOW).filter((a) => a.enabled).map((a) => a.id);
    expect(enabled("awaiting_confirm")).toEqual(["confirm", "edit", "cancel"]);
    expect(enabled("awaiting_confirm", 1)).toEqual(["edit", "cancel"]);
    expect(enabled("draft")).toEqual(["edit", "cancel"]);
    expect(orderSummaryCard.actions(hydrated("confirmed"), null, NOW)).toEqual([]);
  });

  it("maps each order action to one function with the card's version and the tap's key", () => {
    const ctx = { card: card(), key: "11111111-1111-4111-8111-111111111111" };
    expect(orderSummaryCard.act(ctx, "confirm", undefined)).toEqual({
      name: "rs_order_confirm",
      args: { p_order: ctx.card.subject.id, p_version: 2, p_key: ctx.key },
    });
    expect(orderSummaryCard.act(ctx, "cancel", undefined).name).toBe("rs_order_cancel");
    expect(() => orderSummaryCard.act(ctx, "edit", undefined)).toThrow(CardError);
  });

  it("turns a question's options into buttons and records the answer as an event", () => {
    const question = { text: "Add Saturday?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] };
    const hydrated = { data: { subjectLabel: "Kopi Corner" }, state: "open" as const, subjectVersion: 1, audience: "shop" as const, supplierId: null, expiresAt: null };
    expect(questionCard.actions(hydrated, question, NOW).map((a) => a.id)).toEqual(["answer.yes", "answer.no"]);

    const ctx = { card: card({ type: "question", question, subject: { kind: "shop", id: card().shopId ?? "", version: 1 } }), key: "k" };
    expect(questionCard.act(ctx, "answer.no", undefined)).toMatchObject({
      name: "rs_log_event",
      args: { p_name: "question.answered", p_props: { option_id: "no", label: "No" }, p_client_event_id: "k" },
    });
    expect(() => questionCard.act(ctx, "answer.maybe", undefined)).toThrow(CardError);
    expect(questionCard.after(ctx, "answer.no")).toMatchObject({ kind: "set_state", state: "done" });
  });

  it("offers Undo only inside the undo window", () => {
    const data = { actionId: LINES[0], text: "Switched", undoUntil: "2026-11-03T08:05:00Z", undoneAt: null, createdAt: "2026-11-03T07:55:00Z" };
    expect(canUndo(data, NOW)).toBe(true);
    expect(canUndo(data, new Date("2026-11-03T08:05:00Z"))).toBe(false);
    expect(canUndo({ ...data, undoneAt: "2026-11-03T07:58:00Z" }, NOW)).toBe(false);
    expect(canUndo({ ...data, undoUntil: null }, NOW)).toBe(false);
  });
});
