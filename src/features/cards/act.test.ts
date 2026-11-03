import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardError } from "@/cards/errors";
import { fakeDb, type FakeDb } from "@/cards/testing/fake-db";
import { card, cardRow, LINES, ORDER, SHOP } from "@/cards/testing/fixtures";

const mocks = vi.hoisted(() => ({
  db: null as FakeDb | null,
  callRpc: vi.fn(),
  renderCard: vi.fn(),
  setCardState: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/data/rpc", () => ({ callRpc: mocks.callRpc }));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (!mocks.db) throw new Error("no fake db");
    return mocks.db.client;
  },
}));
vi.mock("./render", () => ({ renderCard: mocks.renderCard, setCardState: mocks.setCardState }));

const { actOnCard, reviseCardFields } = await import("./act");

const CARD_ID = "00000000-0000-4000-a100-000000000001";
const NEWER_ID = "00000000-0000-4000-a100-000000000002";
const TAP = "11111111-1111-4111-8111-111111111111";

const orderData = {
  orderId: ORDER,
  orderState: "AWAITING_CONFIRM",
  createdAt: "2026-11-03T08:00:00Z",
  groups: [
    {
      supplierId: "00000000-0000-4000-c000-000000000001",
      supplierName: "Ah Huat Trading",
      deliveryDate: null,
      paymentNote: null,
      minimumOrderCents: null,
      belowMinimum: false,
      subtotalCents: 1080,
      approx: false,
      unknownPriceCount: 0,
      purchaseOrderNumber: null,
      lines: [
        { lineId: LINES[0], itemName: "Eggs", needsPick: false, qty: 2, orderUnit: "tray", unitPriceCents: 540, lineTotalCents: 1080, approx: false },
      ],
    },
  ],
  skippedCount: 0,
  needsPickCount: 0,
  unknownPriceCount: 0,
  approx: false,
  totalCents: 1080,
};

function seed(rows: Record<string, unknown>[], userId: string | null = "user-1") {
  mocks.db = fakeDb({ card_instance: rows }, { userId });
}

const tap = (overrides: Record<string, unknown> = {}) => ({ action: "confirm", subjectVersion: 2, clientActionId: TAP, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  seed([cardRow({ id: CARD_ID, data: orderData })]);
  mocks.renderCard.mockResolvedValue(card({ id: NEWER_ID, state: "confirmed", actions: [] }));
});

describe("actOnCard", () => {
  it("calls the mapped function as the user with the tap's key and version, then re-renders", async () => {
    mocks.callRpc.mockResolvedValue({ ok: true, data: { order_id: ORDER, version: 2, state: "CONFIRMED" } });
    const result = await actOnCard(CARD_ID, tap());
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_order_confirm", { p_order: ORDER, p_version: 2, p_key: TAP });
    expect(mocks.renderCard).toHaveBeenCalledWith(expect.objectContaining({ type: "order_summary", shopId: SHOP, createdBy: "user" }));
    expect(result).toMatchObject({ status: 200, body: { ok: true, card: { id: NEWER_ID, state: "confirmed" } } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/r", "layout");
  });

  it("refuses a superseded card with the latest card for the subject", async () => {
    seed([
      cardRow({ id: CARD_ID, state: "superseded", superseded_by: NEWER_ID, data: orderData }),
      cardRow({ id: NEWER_ID, subject_version: 3, data: orderData }),
    ]);
    const result = await actOnCard(CARD_ID, tap());
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ ok: false, reason: "STALE_CARD", error: "That was an older version. Here's the latest.", latest: { id: NEWER_ID } });
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("returns 409 with a freshly rendered card when the function says the version is stale", async () => {
    mocks.callRpc.mockResolvedValue({ ok: false, error: "That was an older version. Here's the latest.", reason: "STALE_VERSION" });
    mocks.renderCard.mockResolvedValue(card({ id: NEWER_ID, subject: { kind: "shop_order", id: ORDER, version: 3 } }));
    const result = await actOnCard(CARD_ID, tap());
    expect(result).toMatchObject({ status: 409, body: { ok: false, reason: "STALE_VERSION", latest: { id: NEWER_ID, subject: { version: 3 } } } });
    expect(mocks.renderCard).toHaveBeenCalledWith(expect.objectContaining({ createdBy: "system" }));
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("falls back to the stored card when the latest cannot be rendered", async () => {
    mocks.callRpc.mockResolvedValue({ ok: false, error: "That was an older version. Here's the latest.", reason: "STALE_VERSION" });
    mocks.renderCard.mockRejectedValue(new CardError("SETUP", "missing key"));
    const result = await actOnCard(CARD_ID, tap());
    expect(result).toMatchObject({ status: 409, body: { latest: { id: CARD_ID } } });
  });

  it("refuses a tap made on an older copy of the card", async () => {
    const result = await actOnCard(CARD_ID, tap({ subjectVersion: 1 }));
    expect(result).toMatchObject({ status: 409, body: { reason: "STALE_CARD", latest: { id: CARD_ID } } });
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("refuses disabled, client-only and unknown actions without calling the database", async () => {
    seed([cardRow({ id: CARD_ID, data: orderData, actions: [{ id: "confirm", label: "Confirm order", style: "primary", enabled: false }] })]);
    expect((await actOnCard(CARD_ID, tap())).status).toBe(400);
    seed([cardRow({ id: CARD_ID, data: orderData })]);
    expect((await actOnCard(CARD_ID, tap({ action: "edit" }))).body).toMatchObject({ ok: false, reason: "ACTION_UNAVAILABLE" });
    expect((await actOnCard(CARD_ID, tap({ action: "launch" }))).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("validates the body, the card id and the session", async () => {
    expect((await actOnCard(CARD_ID, { action: "confirm" })).status).toBe(400);
    expect((await actOnCard(CARD_ID, tap({ clientActionId: "abc" }))).status).toBe(400);
    expect((await actOnCard("nope", tap())).status).toBe(404);
    expect((await actOnCard(NEWER_ID, tap())).status).toBe(404);
    seed([cardRow({ id: CARD_ID, data: orderData })], null);
    expect((await actOnCard(CARD_ID, tap())).status).toBe(401);
  });

  it("maps other function errors to a status and the user-facing copy", async () => {
    mocks.callRpc.mockResolvedValue({ ok: false, error: "Every line needs an item you chose and a quantity.", reason: "NOT_READY" });
    expect(await actOnCard(CARD_ID, tap())).toEqual({
      status: 409,
      body: { ok: false, error: "Every line needs an item you chose and a quantity.", reason: "NOT_READY" },
    });
  });

  it("reports success even when the refreshed card cannot be saved", async () => {
    mocks.callRpc.mockResolvedValue({ ok: true, data: {} });
    mocks.renderCard.mockRejectedValue(new CardError("SETUP", "missing key"));
    expect(await actOnCard(CARD_ID, tap())).toMatchObject({ status: 200, body: { ok: true, card: null } });
  });

  it("updates an answered question in place instead of rendering a new card", async () => {
    const question = { text: "Add Saturday?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] };
    seed([
      cardRow({
        id: CARD_ID,
        type: "question",
        state: "open",
        subject_kind: "shop",
        subject_id: SHOP,
        subject_version: 1,
        data: { subjectLabel: "Kopi Corner" },
        question,
        actions: [
          { id: "answer.yes", label: "Yes", style: "secondary", enabled: true },
          { id: "answer.no", label: "No", style: "secondary", enabled: true },
        ],
      }),
    ]);
    mocks.callRpc.mockResolvedValue({ ok: true, data: null });
    mocks.setCardState.mockResolvedValue(card({ id: CARD_ID, type: "question", state: "done" }));
    const result = await actOnCard(CARD_ID, tap({ action: "answer.yes", subjectVersion: 1 }));
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_log_event", expect.objectContaining({ p_name: "question.answered", p_client_event_id: TAP }));
    expect(mocks.setCardState).toHaveBeenCalledWith(CARD_ID, "done", [
      { id: "answer.yes", label: "Yes", style: "primary", enabled: false },
      { id: "answer.no", label: "No", style: "secondary", enabled: false },
    ]);
    expect(mocks.renderCard).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });
});

describe("reviseCardFields", () => {
  it("saves quantity changes as a new order version and re-renders", async () => {
    mocks.callRpc.mockResolvedValue({ ok: true, data: { order_id: ORDER, version: 3, state: "AWAITING_CONFIRM" } });
    const result = await reviseCardFields(CARD_ID, { subjectVersion: 2, clientActionId: TAP, changes: [{ lineId: LINES[0], qty: 4 }] });
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_order_revise", {
      p_order: ORDER,
      p_version: 2,
      p_changes: [{ op: "qty", line_id: LINES[0], qty: 4 }],
      p_key: TAP,
    });
    expect(result.status).toBe(200);
  });

  it("refuses lines that are not on the card and quantities out of range", async () => {
    expect((await reviseCardFields(CARD_ID, { subjectVersion: 2, clientActionId: TAP, changes: [{ lineId: LINES[3], qty: 4 }] })).status).toBe(400);
    expect((await reviseCardFields(CARD_ID, { subjectVersion: 2, clientActionId: TAP, changes: [{ lineId: LINES[0], qty: 0 }] })).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("returns the latest card when the edit was made on an older version", async () => {
    mocks.callRpc.mockResolvedValue({ ok: false, error: "That was an older version. Here's the latest.", reason: "STALE_VERSION" });
    const result = await reviseCardFields(CARD_ID, { subjectVersion: 2, clientActionId: TAP, changes: [{ lineId: LINES[0], qty: 4 }] });
    expect(result).toMatchObject({ status: 409, body: { reason: "STALE_VERSION", latest: { id: NEWER_ID } } });
  });
});
