import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "@/domain/ask/types";

const mocks = vi.hoisted(() => ({
  getBuyerCatalogue: vi.fn(),
  addLinesToDraft: vi.fn(),
  revalidatePath: vi.fn(),
  readDraft: vi.fn(),
  placeOrdersAction: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/data/session", () => ({ requireRole: async () => ({ userId: "u1", orgId: "o1" }) }));
vi.mock("@/data/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/features/buyer/queries", () => ({ getBuyerCatalogue: mocks.getBuyerCatalogue }));
vi.mock("@/features/ordering/draft-store", () => ({ addLinesToDraft: mocks.addLinesToDraft }));
vi.mock("@/features/ordering/queries", () => ({ readDraft: mocks.readDraft }));
vi.mock("@/features/ordering/actions", () => ({ placeOrdersAction: mocks.placeOrdersAction }));
vi.mock("./respond", () => ({ respondToAsk: vi.fn() }));

const { addToCartAction, placeCartAction } = await import("./actions");

const EGGS = "aaaaaaaa-0000-4000-8000-000000000001";
const MILK = "aaaaaaaa-0000-4000-8000-000000000002";
const HIDDEN = "aaaaaaaa-0000-4000-8000-000000000009";

function cartLine(overrides: Partial<CartLine>): CartLine {
  return { productId: null, qty: 1, sourceText: "", options: [], state: "not_found", kg: null, qtyAssumed: false, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBuyerCatalogue.mockResolvedValue([
    { id: EGGS, status: "active", available: 40 },
    { id: MILK, status: "active", available: 40 },
  ]);
  mocks.addLinesToDraft.mockResolvedValue({ ok: true, data: { version: 4 } });
});

describe("addToCartAction", () => {
  it("adds every line with its state and options, checked against the buyer's catalogue, and counts them", async () => {
    const result = await addToCartAction([
      cartLine({ productId: EGGS, qty: 2, sourceText: "2 ctn eggs", options: [EGGS], state: "matched" }),
      cartLine({ qty: 5, sourceText: "5 tins milk", options: [MILK, HIDDEN], state: "check" }),
      cartLine({ productId: HIDDEN, sourceText: "1 box wagyu", state: "matched" }),
    ]);
    expect(result).toEqual({ ok: true, data: { added: 3 } });
    expect(mocks.addLinesToDraft).toHaveBeenCalledWith("u1", [
      cartLine({ productId: EGGS, qty: 2, sourceText: "2 ctn eggs", options: [EGGS], state: "matched" }),
      cartLine({ qty: 5, sourceText: "5 tins milk", options: [MILK], state: "check" }),
      cartLine({ sourceText: "1 box wagyu", state: "not_found" }),
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/buyer", "layout");
  });

  it("rejects malformed lines without touching the cart", async () => {
    const result = await addToCartAction([cartLine({ productId: "not-a-uuid" })]);
    expect(result).toEqual({ ok: false, error: "Check the details and try again." });
    expect(await addToCartAction([])).toMatchObject({ ok: false });
    expect(mocks.addLinesToDraft).not.toHaveBeenCalled();
  });

  it("passes on a failed save without revalidating", async () => {
    mocks.addLinesToDraft.mockResolvedValue({ ok: false, error: "The cart can have up to 60 lines. Place or remove some lines first." });
    const result = await addToCartAction([cartLine({ productId: EGGS, state: "manual" })]);
    expect(result).toEqual({ ok: false, error: "The cart can have up to 60 lines. Place or remove some lines first." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});


describe("placeCartAction", () => {
  const KEY = "bbbbbbbb-0000-4000-8000-000000000001";
  const line = (overrides: Record<string, unknown>) => ({
    id: "x",
    sourceText: "",
    productId: EGGS,
    qty: 1,
    kg: null,
    qtyAssumed: false,
    options: [],
    state: "matched",
    ...overrides,
  });
  const placed = { orders: [{ id: "o1", number: 1070, supplierName: "Harbour Dry Goods" }] };

  beforeEach(() => {
    mocks.readDraft.mockResolvedValue({
      lines: [line({ id: "a", qty: 2, sourceText: "2 ctn eggs" }), line({ id: "b", productId: MILK, qty: 5, sourceText: "milk" })],
      version: 7,
    });
    mocks.placeOrdersAction.mockResolvedValue({ ok: true, data: placed });
  });

  it("places the cart as the assistant showed it, with the buyer's key", async () => {
    expect(await placeCartAction(7, KEY)).toEqual({ ok: true, data: placed });
    expect(mocks.readDraft).toHaveBeenCalledWith("u1");
    expect(mocks.placeOrdersAction).toHaveBeenCalledWith({
      lines: [
        { productId: EGGS, qty: 2, sourceText: "2 ctn eggs" },
        { productId: MILK, qty: 5, sourceText: "milk" },
      ],
      draftVersion: 7,
      key: KEY,
    });
  });

  it("refuses when the cart changed since the assistant read it", async () => {
    expect(await placeCartAction(6, KEY)).toMatchObject({ ok: false, error: "Your cart changed. Ask again or open your cart." });
    expect(mocks.placeOrdersAction).not.toHaveBeenCalled();
  });

  it("refuses when a line needs the buyer, or the cart is empty", async () => {
    mocks.readDraft.mockResolvedValue({ lines: [line({ productId: null, state: "check" })], version: 7 });
    expect(await placeCartAction(7, KEY)).toMatchObject({ ok: false });
    mocks.readDraft.mockResolvedValue({ lines: [line({ qty: 41 })], version: 7 });
    expect(await placeCartAction(7, KEY)).toMatchObject({ ok: false });
    mocks.readDraft.mockResolvedValue({ lines: [], version: 7 });
    expect(await placeCartAction(7, KEY)).toMatchObject({ ok: false });
    expect(mocks.placeOrdersAction).not.toHaveBeenCalled();
  });

  it("rejects a malformed key", async () => {
    expect(await placeCartAction(7, "not-a-key")).toEqual({ ok: false, error: "Check the details and try again." });
    expect(mocks.readDraft).not.toHaveBeenCalled();
  });

  it("puts stock and stale-cart refusals in chat words", async () => {
    mocks.placeOrdersAction.mockResolvedValue({ ok: false, error: "Check the highlighted lines.", reason: "STOCK_SHORT", detail: "" });
    expect(await placeCartAction(7, KEY)).toMatchObject({
      ok: false,
      error: "Some items do not have enough stock now. Open your cart to change them.",
    });
    mocks.placeOrdersAction.mockResolvedValue({ ok: false, error: "Something went wrong. Try again." });
    expect(await placeCartAction(7, KEY)).toMatchObject({ ok: false, error: "Something went wrong. Try again." });
  });
});
