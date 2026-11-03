import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { numberFacts } from "@/domain/ask/prompt";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/integrations/claude/client", () => ({
  getClaudeClient: () => ({ messages: { create: mocks.create } }),
  claudeModel: () => "claude-sonnet-5-5",
  isClaudeConfigured: () => true,
}));

const { answerOpenQuestion } = await import("./answer");

const facts = numberFacts([
  "Business: Mei's Noodle House. Tradelink Assistant can only see this business's orders and prices.",
  "Spend this week (since Monday, Singapore time): S$612.50 of a S$900.00 weekly budget, S$287.50 left.",
  "Open order ORD-1044 from Harbour Dry Goods: Out for delivery, total S$120.00. Items: 2 × Jasmine rice 5kg.",
]);

function reply(output: unknown, stopReason = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text: typeof output === "string" ? output : JSON.stringify(output) }],
    stop_reason: stopReason,
    stop_details: null,
    usage: { input_tokens: 640, output_tokens: 48 },
  };
}

beforeEach(() => {
  mocks.create.mockReset();
});

describe("answerOpenQuestion: request", () => {
  it("sends trusted instructions in system and quoted data in the user turn, with structured output", async () => {
    mocks.create.mockResolvedValue(reply({ answer: "You have S$287.50 left this week.", factIds: ["F2"] }));
    await answerOpenQuestion("Can I afford <more> rice?", [{ role: "buyer", text: "hi" }], facts);

    const [body, options] = mocks.create.mock.calls[0] ?? [];
    expect(options).toEqual({ timeout: 20_000, maxRetries: 1 });
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.output_config.effort).toBe("low");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("thinking");
    expect(body.system).not.toContain("Mei's Noodle House");
    expect(body.messages).toHaveLength(1);
    const content: string = body.messages[0].content;
    expect(content).toContain("F2: Spend this week");
    expect(content).toContain("Buyer: hi");
    expect(content).toContain("Can I afford ‹more› rice?\n</buyer_message>");
  });
});

describe("answerOpenQuestion: outcomes", () => {
  it("returns a grounded answer with the facts it cites", async () => {
    mocks.create.mockResolvedValue(
      reply({ answer: "ORD-1044 from Harbour Dry Goods is out for delivery (F3).", factIds: ["F3"] }),
    );
    const { answer, usage } = await answerOpenQuestion("Where is my rice?", [], facts);
    expect(answer).toEqual({
      kind: "grounded",
      text: "ORD-1044 from Harbour Dry Goods is out for delivery.",
      factIds: ["F3"],
    });
    expect(usage).toMatchObject({ inputTokens: 640, outputTokens: 48, outcome: "ok" });
  });

  it("drops fact IDs that were never given", async () => {
    mocks.create.mockResolvedValue(reply({ answer: "You have S$287.50 left.", factIds: ["F2", "F7", "F42"] }));
    const { answer } = await answerOpenQuestion("How much budget is left?", [], facts);
    expect(answer).toEqual({ kind: "grounded", text: "You have S$287.50 left.", factIds: ["F2"] });
  });

  it("does not show an answer whose only citations are unknown", async () => {
    mocks.create.mockResolvedValue(
      reply({ answer: "Seaside Kopitiam paid S$30.00 for oil.", factIds: ["F9"] }),
    );
    const { answer, usage } = await answerOpenQuestion("What do other shops pay for oil?", [], facts);
    expect(answer).toEqual({ kind: "ungrounded" });
    expect(usage.outcome).toBe("ok");
  });

  it("treats a decline with no citations as ungrounded", async () => {
    mocks.create.mockResolvedValue(reply({ answer: "I cannot help with that here.", factIds: [] }));
    const { answer } = await answerOpenQuestion("Write me a poem", [], facts);
    expect(answer).toEqual({ kind: "ungrounded" });
  });

  it("treats a refusal as ungrounded and records it", async () => {
    mocks.create.mockResolvedValue(reply("", "refusal"));
    const { answer, usage } = await answerOpenQuestion("Something harmful", [], facts);
    expect(answer).toEqual({ kind: "ungrounded" });
    expect(usage).toMatchObject({ outcome: "refusal", inputTokens: 640 });
  });

  it("treats output that breaks the schema as invalid", async () => {
    mocks.create.mockResolvedValue(reply({ answer: "x".repeat(801), factIds: ["F1"] }));
    const { answer, usage } = await answerOpenQuestion("Tell me everything", [], facts);
    expect(answer).toEqual({ kind: "ungrounded" });
    expect(usage.outcome).toBe("invalid_output");
  });

  it("treats a cut-off reply as invalid", async () => {
    mocks.create.mockResolvedValue(reply('{"answer":"You have', "max_tokens"));
    const { usage } = await answerOpenQuestion("Budget?", [], facts);
    expect(usage.outcome).toBe("invalid_output");
  });

  it("reports a timeout as unavailable", async () => {
    mocks.create.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    const { answer, usage } = await answerOpenQuestion("Where is my rice?", [], facts);
    expect(answer).toEqual({ kind: "unavailable" });
    expect(usage).toMatchObject({ outcome: "timeout", inputTokens: 0, outputTokens: 0 });
  });

  it("reports an API error as unavailable", async () => {
    mocks.create.mockRejectedValue(new Anthropic.APIConnectionError({ message: "down" }));
    const { answer, usage } = await answerOpenQuestion("Where is my rice?", [], facts);
    expect(answer).toEqual({ kind: "unavailable" });
    expect(usage.outcome).toBe("error");
  });

  it("does not swallow programming errors", async () => {
    mocks.create.mockRejectedValue(new TypeError("bug"));
    await expect(answerOpenQuestion("Where is my rice?", [], facts)).rejects.toThrow("bug");
  });
});
