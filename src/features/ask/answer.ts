import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  askSystemPrompt,
  askUserPrompt,
  cleanAnswer,
  knownFactIds,
  MAX_ANSWER_CHARS,
  type Fact,
} from "@/domain/ask/prompt";
import type { AskTurn } from "@/domain/ask/types";
import { claudeModel, getClaudeClient } from "@/integrations/claude/client";

export type AnswerOutcome = "ok" | "refusal" | "timeout" | "error" | "invalid_output";

export type AnswerUsage = { inputTokens: number; outputTokens: number; latencyMs: number; outcome: AnswerOutcome };

/**
 * "grounded": an answer that cites at least one fact it was given.
 * "ungrounded": a decline, a refusal, unusable output, or an answer citing no known fact.
 * "unavailable": the API timed out or failed.
 */
export type OpenAnswer =
  | { kind: "grounded"; text: string; factIds: string[] }
  | { kind: "ungrounded" }
  | { kind: "unavailable" };

const MAX_TOKENS = 1024;
const REQUEST_OPTIONS = { timeout: 20_000, maxRetries: 1 };

const AnswerSchema = z.object({
  answer: z.string().max(MAX_ANSWER_CHARS).describe("The reply to the buyer, in plain sentences."),
  factIds: z.array(z.string()).describe("IDs of the facts the answer relies on, for example F2."),
});

const ANSWER_FORMAT = zodOutputFormat(AnswerSchema);

function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function parseAnswer(message: Anthropic.Message): z.infer<typeof AnswerSchema> | null {
  try {
    return ANSWER_FORMAT.parse(responseText(message));
  } catch (error) {
    if (error instanceof Anthropic.AnthropicError) return null;
    throw error;
  }
}

function outcomeForError(error: unknown): AnswerOutcome {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.AnthropicError) return "error";
  throw error;
}

/**
 * Answers an open question from numbered facts only (BUY-48, BUY-50). The buyer's words and
 * the facts go in the user turn as quoted data; fact IDs the model invents are dropped, and an
 * answer that cites no known fact is not shown. Call only when Claude is configured.
 */
export async function answerOpenQuestion(
  question: string,
  history: AskTurn[],
  facts: Fact[],
): Promise<{ answer: OpenAnswer; usage: AnswerUsage }> {
  const startedAt = Date.now();
  const usage = (outcome: AnswerOutcome, inputTokens = 0, outputTokens = 0): AnswerUsage => ({
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startedAt,
    outcome,
  });

  let message: Anthropic.Message;
  try {
    message = await getClaudeClient().messages.create(
      {
        model: claudeModel(),
        max_tokens: MAX_TOKENS,
        system: askSystemPrompt(),
        messages: [{ role: "user", content: askUserPrompt(question, history, facts) }],
        output_config: { effort: "low", format: ANSWER_FORMAT },
      },
      REQUEST_OPTIONS,
    );
  } catch (error) {
    return { answer: { kind: "unavailable" }, usage: usage(outcomeForError(error)) };
  }

  const tokens = [message.usage.input_tokens, message.usage.output_tokens] as const;
  if (message.stop_reason === "refusal") return { answer: { kind: "ungrounded" }, usage: usage("refusal", ...tokens) };
  const parsed = message.stop_reason === "end_turn" ? parseAnswer(message) : null;
  if (!parsed) return { answer: { kind: "ungrounded" }, usage: usage("invalid_output", ...tokens) };

  const factIds = knownFactIds(parsed.factIds, facts);
  const text = cleanAnswer(parsed.answer);
  if (factIds.length === 0 || text === "") return { answer: { kind: "ungrounded" }, usage: usage("ok", ...tokens) };
  return { answer: { kind: "grounded", text, factIds }, usage: usage("ok", ...tokens) };
}
