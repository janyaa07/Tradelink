import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardError } from "@/cards/errors";
import { card, ORDER, SHOP, THREAD } from "@/cards/testing/fixtures";

const mocks = vi.hoisted(() => ({ renderCard: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/cards/render", () => ({ renderCard: mocks.renderCard }));

const { executeRenderCard, RENDER_CARD_TOOL, toToolResultBlock } = await import("./render-card-tool");

const CONTEXT = { shopId: SHOP, threadId: THREAD };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.renderCard.mockResolvedValue(card());
});

describe("RENDER_CARD_TOOL", () => {
  it("exposes only the type, a subject reference, a reason and a question", () => {
    expect(RENDER_CARD_TOOL.name).toBe("render_card");
    expect(RENDER_CARD_TOOL.input_schema.type).toBe("object");
    expect(Object.keys(RENDER_CARD_TOOL.input_schema.properties as object).sort()).toEqual(["question", "reason", "subject", "type"]);
    expect(RENDER_CARD_TOOL.input_schema.required).toEqual(["type", "subject"]);
    expect(RENDER_CARD_TOOL.input_schema.additionalProperties).toBe(false);
    expect(RENDER_CARD_TOOL.input_schema.$schema).toBeUndefined();
  });
});

describe("executeRenderCard", () => {
  it("renders with the shop and thread from the agent context, not the model", async () => {
    const result = await executeRenderCard(
      { type: "order_summary", subject: { kind: "shop_order", id: ORDER }, reason: "You asked for a summary." },
      CONTEXT,
    );
    expect(mocks.renderCard).toHaveBeenCalledWith({
      type: "order_summary",
      subject: { kind: "shop_order", id: ORDER },
      shopId: SHOP,
      threadId: THREAD,
      reason: { text: "You asked for a summary." },
      question: null,
      createdBy: "agent",
    });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content)).toEqual({
      card_id: card().id,
      type: "order_summary",
      state: "awaiting_confirm",
      subject_version: 2,
      actions: ["confirm", "edit", "cancel"],
    });
  });

  it("refuses model-supplied data such as prices or a shop id", async () => {
    const withData = await executeRenderCard(
      { type: "order_summary", subject: { kind: "shop_order", id: ORDER }, data: { totalCents: 1 } },
      CONTEXT,
    );
    expect(withData).toMatchObject({ isError: true, card: null });
    expect(withData.content).toMatch(/^INVALID_INPUT/);
    const withShop = await executeRenderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER, shopId: SHOP } }, CONTEXT);
    expect(withShop.isError).toBe(true);
    expect(mocks.renderCard).not.toHaveBeenCalled();
  });

  it("returns the card layer's refusal to the model so nothing is shown", async () => {
    mocks.renderCard.mockRejectedValue(new CardError("INVALID_CARD", "The order_summary card did not pass its checks."));
    const result = await executeRenderCard({ type: "order_summary", subject: { kind: "shop_order", id: ORDER } }, CONTEXT);
    expect(result).toEqual({ isError: true, content: "INVALID_CARD: The order_summary card did not pass its checks.", card: null });
    expect(toToolResultBlock("tool_1", result)).toEqual({
      type: "tool_result",
      tool_use_id: "tool_1",
      content: result.content,
      is_error: true,
    });
  });

  it("hides unexpected failures behind a generic error", async () => {
    mocks.renderCard.mockRejectedValue(new Error("socket hang up"));
    const result = await executeRenderCard({ type: "question", subject: { kind: "shop", id: SHOP } }, CONTEXT);
    expect(result).toMatchObject({ isError: true, card: null });
    expect(result.content).not.toContain("socket");
  });
});
