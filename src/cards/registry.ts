import { agentActionNoticeCard } from "./agent_action_notice/definition";
import { CardTypeSchema, type CardType } from "./envelope";
import { CardError } from "./errors";
import { orderSummaryCard } from "./order_summary/definition";
import { questionCard } from "./question/definition";
import type { CardDefinition } from "./types";

/** Every card type the server can render (docs/PLAN.md, section 4.2). Components live in CardRenderer. */
export const CARD_REGISTRY: { readonly [T in CardType]: CardDefinition<unknown> } = {
  order_summary: orderSummaryCard,
  agent_action_notice: agentActionNoticeCard,
  question: questionCard,
};

export function getCardDefinition(type: string): CardDefinition<unknown> {
  const parsed = CardTypeSchema.safeParse(type);
  if (!parsed.success) throw new CardError("INVALID_INPUT", `Unknown card type "${type}".`);
  return CARD_REGISTRY[parsed.data];
}
