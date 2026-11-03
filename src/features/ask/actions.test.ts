import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "@/domain/ask/types";

const mocks = vi.hoisted(() => ({
  getBuyerCatalogue: vi.fn(),
  addLinesToDraft: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/data/session", () => ({ requireRole: async () => ({ userId: "u1", orgId: "o1" }) }));
vi.mock("@/data/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/features/buyer/queries", () => ({ getBuyerCatalogue: mocks.getBuyerCatalogue }));
vi.mock("@/features/ordering/draft-store", () => ({ addLinesToDraft: mocks.addLinesToDraft }));
vi.mock("./respond", () => ({ respondToAsk: vi.fn() }));

const { addToCartAction } = await import("./actions");

const EGGS = "aaaaaaaa-0000-4000-8000-000000000001";
const MILK = "aaaaaaaa-0000-4000-8000-000000000002";
const HIDDEN = "aaaaaaaa-0000-4000-8000-000000000009";

function cartLine(overrides: Partial<CartLine>): CartLine {
  return { productId: null, qty: 1, sourceText: "", options: [], state: "not_found", kg: null, qtyAssumed: false, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBuyerCatalogue.mockResolvedValue([{ id: EGGS }, { id: MILK }]);
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
