import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CardQuestionSchema, CardTypeSchema, SubjectKindSchema, type CardEnvelope } from "@/cards/envelope";
import { CardError } from "@/cards/errors";
import { renderCard } from "@/features/cards/render";
import { logger } from "@/lib/logger";

/**
 * What the model may pass to render_card: a card type, a reference to the subject, and wording.
 * Prices, totals, items, dates and states are never taken from the model (docs/PLAN.md, section 2.3);
 * the server loads them from the database.
 */
export const RenderCardToolInputSchema = z
  .object({
    type: CardTypeSchema.describe("The card to show."),
    subject: z
      .object({
        kind: SubjectKindSchema.describe("What the card is about."),
        id: z.guid().describe("The id of that row, copied from a tool result."),
      })
      .strict(),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Why the card appeared, in one short sentence. Required for agent_action_notice."),
    question: CardQuestionSchema.optional().describe("One short question with 2 to 4 options. Required for question cards."),
  })
  .strict();
export type RenderCardToolInput = z.infer<typeof RenderCardToolInputSchema>;

function inputSchema(): Anthropic.Tool.InputSchema {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(RenderCardToolInputSchema) };
  delete schema.$schema;
  return { ...schema, type: "object" };
}

export const RENDER_CARD_TOOL: Anthropic.Tool = {
  name: "render_card",
  description: [
    "Shows the owner a card instead of a prose reply. Always use it when a card fits.",
    "order_summary shows a shop_order with its lines, prices, totals and buttons; agent_action_notice tells the owner",
    "what Restock did (subject agent_action) and offers Undo; question asks one short question about any subject.",
    "Pass only the card type, the subject reference and wording. The server loads every item, price, total, date",
    "and state from the database, so never put them in the reason or the question.",
    "If the tool returns an error, nothing was shown: fix the input or answer without a card.",
  ].join(" "),
  input_schema: inputSchema(),
};

/** Set by the agent runtime from the conversation, never by the model. */
export type RenderCardToolContext = { shopId: string; threadId: string | null };

export type RenderCardToolResult = { isError: boolean; content: string; card: CardEnvelope | null };

/** What the model sees after a card is shown: its id, state and buttons, not its numbers. */
function summary(card: CardEnvelope): string {
  return JSON.stringify({
    card_id: card.id,
    type: card.type,
    state: card.state,
    subject_version: card.subject.version,
    actions: card.actions.filter((action) => action.enabled).map((action) => action.id),
  });
}

/** Runs one render_card call. A validation failure goes back to the model as an error; nothing is shown. */
export async function executeRenderCard(input: unknown, context: RenderCardToolContext): Promise<RenderCardToolResult> {
  const parsed = RenderCardToolInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "input";
    return { isError: true, content: `INVALID_INPUT: ${where}: ${issue?.message ?? "invalid"}`, card: null };
  }
  const { type, subject, reason, question } = parsed.data;
  try {
    const card = await renderCard({
      type,
      subject,
      shopId: context.shopId,
      threadId: context.threadId,
      reason: reason ? { text: reason } : null,
      question: question ?? null,
      createdBy: "agent",
    });
    return { isError: false, content: summary(card), card };
  } catch (error) {
    if (error instanceof CardError) {
      logger.warn("render_card_refused", { type, reason: error.reason });
      return { isError: true, content: `${error.reason}: ${error.message}`, card: null };
    }
    logger.error("render_card_failed", { type });
    return { isError: true, content: "DB: The card could not be shown. Try again later.", card: null };
  }
}

export function toToolResultBlock(toolUseId: string, result: RenderCardToolResult): Anthropic.ToolResultBlockParam {
  return { type: "tool_result", tool_use_id: toolUseId, content: result.content, is_error: result.isError };
}
