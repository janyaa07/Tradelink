import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "@/cards/testing/fake-db";
import { AH_HUAT, cardRow, LINES, ORDER, OTHER_SHOP, SHOP, THREAD } from "@/cards/testing/fixtures";

const mocks = vi.hoisted(() => ({ db: null as FakeDb | null, configured: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/data/supabase/admin", () => ({
  hasAdminClient: () => mocks.configured,
  createSupabaseAdminClient: () => {
    if (!mocks.db) throw new Error("no fake db");
    return mocks.db.client;
  },
}));

const { renderCard } = await import("./render");

const CARD_ID = "00000000-0000-4000-a100-000000000002";

function seed(state = "AWAITING_CONFIRM", price: number | null = 540): FakeDb {
  const tables = {
    chat_thread: [{ id: THREAD, shop_id: SHOP }],
    shop_order: [{ id: ORDER, shop_id: SHOP, state, version: 3, created_at: "2026-11-03T08:00:00Z" }],
    shop_order_line: [
      {
        order_id: ORDER,
        id: LINES[0],
        position: 1,
        raw_text: "eggs",
        qty: 2,
        status: "PICKED",
        expected_price_cents: price,
        delivery_date: null,
        shop_item: {
          order_unit: "tray",
          billing_type: "fixed",
          supplier_id: AH_HUAT,
          product: { brand: "Seng Choon", name: "Eggs", variant: null, pack_size: "tray of 30" },
        },
      },
    ],
    shop_supplier: [{ shop_id: SHOP, supplier_id: AH_HUAT, minimum_order_cents: 5000, payment_terms: "cod", supplier: { name: "Ah Huat Trading" } }],
    purchase_order: [],
    card_instance: [] as Record<string, unknown>[],
  };
  const db = fakeDb(tables, {
    rpc: (name, args) => {
      if (name !== "rs_put_card") return { data: null, error: null };
      const p = args.p_card as Record<string, unknown>;
      tables.card_instance.push(cardRow({ ...p, id: CARD_ID }));
      return { data: CARD_ID, error: null };
    },
  });
  return db;
}

beforeEach(() => {
  mocks.configured = true;
  mocks.db = seed();
});

describe("renderCard", () => {
  it("hydrates the card from the database and stores it with rs_put_card", async () => {
    const card = await renderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER }, shopId: SHOP, threadId: THREAD });
    expect(card.id).toBe(CARD_ID);

    const put = mocks.db?.rpc.find((call) => call.name === "rs_put_card");
    expect(put?.args.p_post).toBe(true);
    expect(put?.args.p_card).toMatchObject({
      type: "order_summary",
      shop_id: SHOP,
      subject_kind: "shop_order",
      subject_id: ORDER,
      subject_version: 3,
      state: "awaiting_confirm",
      thread_id: THREAD,
      data: { totalCents: 1080, groups: [{ supplierName: "Ah Huat Trading", belowMinimum: true }] },
    });
    const actions = (put?.args.p_card as { actions: { id: string; enabled: boolean }[] }).actions;
    expect(actions.map((action) => [action.id, action.enabled])).toEqual([
      ["confirm", true],
      ["edit", true],
      ["cancel", true],
    ]);
  });

  it("keeps only requested actions the state allows", async () => {
    await renderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER }, shopId: SHOP, actions: ["confirm", "undo"] });
    const put = mocks.db?.rpc.find((call) => call.name === "rs_put_card");
    expect((put?.args.p_card as { actions: { id: string }[] }).actions.map((action) => action.id)).toEqual(["confirm"]);
    expect(put?.args.p_post).toBe(false);
  });

  it("fails with a setup error when the secret key is missing", async () => {
    mocks.configured = false;
    await expect(renderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER }, shopId: SHOP })).rejects.toMatchObject({
      reason: "SETUP",
    });
  });

  it("refuses a subject from another shop, a thread from another shop, or the wrong subject kind", async () => {
    await expect(renderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER }, shopId: OTHER_SHOP })).rejects.toMatchObject({
      reason: "NOT_FOUND",
    });
    mocks.db = seed();
    await expect(
      renderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER }, shopId: SHOP, threadId: "00000000-0000-4000-f000-000000000009" }),
    ).rejects.toMatchObject({ reason: "NOT_FOUND" });
    await expect(renderCard({ type: "order_summary", subject: { kind: "agent_action", id: ORDER }, shopId: SHOP })).rejects.toMatchObject({
      reason: "INVALID_INPUT",
    });
    expect(mocks.db.rpc).toEqual([]);
  });

  it("requires a reason on a notice and a question on a question card", async () => {
    await expect(renderCard({ type: "agent_action_notice", subject: { kind: "agent_action", id: ORDER }, shopId: SHOP })).rejects.toMatchObject({
      reason: "INVALID_INPUT",
    });
    await expect(renderCard({ type: "question", subject: { kind: "shop", id: SHOP }, shopId: SHOP })).rejects.toMatchObject({
      reason: "INVALID_INPUT",
    });
  });

  it("stores nothing when the hydrated data fails its schema", async () => {
    mocks.db = seed("AWAITING_CONFIRM", -5);
    await expect(renderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER }, shopId: SHOP })).rejects.toMatchObject({
      reason: "INVALID_CARD",
    });
    expect(mocks.db.rpc).toEqual([]);
  });

  it("rejects malformed input before reading anything", async () => {
    await expect(renderCard({ type: "order_summary", subject: { kind: "shop_order", id: "not-an-id" }, shopId: SHOP })).rejects.toMatchObject({
      reason: "INVALID_INPUT",
    });
    expect(mocks.db?.queries).toEqual([]);
  });
});
