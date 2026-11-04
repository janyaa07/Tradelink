import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ACTION_ID,
  CardActionSchema,
  CardQuestionSchema,
  CardReasonSchema,
  CardStateSchema,
  CardSurfaceSchema,
  CardTypeSchema,
  SubjectKindSchema,
  type CardAction,
  type CardEnvelope,
  type CardState,
} from "@/cards/envelope";
import { CardError, MISSING_SECRET_KEY } from "@/cards/errors";
import { getCardDefinition } from "@/cards/registry";
import { createSupabaseAdminClient, hasAdminClient } from "@/data/supabase/admin";
import { parseDbError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadCard } from "./queries";

export const RenderCardInputSchema = z.object({
  type: CardTypeSchema,
  subject: z.object({ kind: SubjectKindSchema, id: z.guid() }),
  /** From the session or agent context, never from the model. */
  shopId: z.guid(),
  threadId: z.guid().nullable().optional(),
  reason: CardReasonSchema.nullable().optional(),
  question: CardQuestionSchema.nullable().optional(),
  /** A subset of what the type allows in this state; anything else is dropped. */
  actions: z.array(z.string().regex(ACTION_ID)).max(10).optional(),
  createdBy: z.enum(["agent", "user", "system"]).default("agent"),
  surfaces: z.array(CardSurfaceSchema).min(1).max(3).optional(),
});
export type RenderCardInput = z.input<typeof RenderCardInputSchema>;

function adminClient(): SupabaseClient {
  if (!hasAdminClient()) throw new CardError("SETUP", MISSING_SECRET_KEY);
  return createSupabaseAdminClient();
}

function issueText(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input.";
}

async function storedCard(db: SupabaseClient, id: unknown): Promise<CardEnvelope> {
  const card = typeof id === "string" ? await loadCard(db, id) : null;
  if (!card) throw new CardError("DB", "The card was saved but could not be read back.");
  return card;
}

/**
 * The server side of render_card (docs/AI_DESIGN.md, section 4.1): hydrates the card from the database
 * (never from the model's numbers or items), validates it, works out the buttons for the subject's
 * state, stores it with rs_put_card (which supersedes older cards for the subject) and returns it.
 */
export async function renderCard(input: RenderCardInput, now: Date = new Date()): Promise<CardEnvelope> {
  const parsed = RenderCardInputSchema.safeParse(input);
  if (!parsed.success) throw new CardError("INVALID_INPUT", issueText(parsed.error));
  const { type, subject, shopId, reason = null, question = null } = parsed.data;
  const threadId = parsed.data.threadId ?? null;

  const definition = getCardDefinition(type);
  if (!definition.subjectKinds.includes(subject.kind)) {
    throw new CardError("INVALID_INPUT", `A ${type} card is about ${definition.subjectKinds.join(" or ")}, not ${subject.kind}.`);
  }
  if (definition.requiresReason && !reason) throw new CardError("INVALID_INPUT", `A ${type} card needs a reason.`);
  if (definition.requiresQuestion && !question) throw new CardError("INVALID_INPUT", `A ${type} card needs a question.`);

  const db = adminClient();
  if (threadId) {
    const { data: thread } = await db.from("chat_thread").select("id").eq("id", threadId).eq("shop_id", shopId).maybeSingle();
    if (!thread) throw new CardError("NOT_FOUND", "No chat thread with that id in this shop.");
  }

  const hydrated = await definition.build({ db, subject, shopId, now });
  const data = definition.dataSchema.safeParse(hydrated.data);
  if (!data.success) {
    logger.warn("card_invalid", { type });
    throw new CardError("INVALID_CARD", `The ${type} card did not pass its checks: ${issueText(data.error)}`);
  }
  const allowed = definition.actions({ ...hydrated, data: data.data }, question, now);
  const actions = parsed.data.actions ? allowed.filter((action) => parsed.data.actions?.includes(action.id)) : allowed;

  const { data: id, error } = await db.rpc("rs_put_card", {
    p_card: {
      type,
      schema_version: definition.schemaVersion,
      audience: hydrated.audience,
      shop_id: shopId,
      supplier_id: hydrated.supplierId,
      subject_kind: subject.kind,
      subject_id: subject.id,
      subject_version: hydrated.subjectVersion,
      state: hydrated.state,
      data: data.data,
      actions,
      reason,
      question,
      surfaces: parsed.data.surfaces ?? ["chat"],
      thread_id: threadId,
      created_by: parsed.data.createdBy,
      expires_at: hydrated.expiresAt,
    },
    p_post: threadId !== null,
  });
  if (error) {
    const dbError = parseDbError(error.message);
    logger.error("card_put_failed", { type, reason: dbError.reason, pgCode: error.code });
    throw new CardError("DB", dbError.message);
  }
  const card = await storedCard(db, id);
  logger.info("card_rendered", { type, state: card.state, subjectVersion: card.subject.version });
  return card;
}

const SetStateSchema = z.object({ id: z.guid(), state: CardStateSchema, actions: z.array(CardActionSchema) });

/** A new state chip and buttons on the same card version (for example a question once answered). */
export async function setCardState(id: string, state: CardState, actions: CardAction[]): Promise<CardEnvelope> {
  const parsed = SetStateSchema.safeParse({ id, state, actions });
  if (!parsed.success) throw new CardError("INVALID_INPUT", issueText(parsed.error));
  const db = adminClient();
  const { error } = await db.rpc("rs_set_card_state", { p_card: id, p_state: state, p_actions: actions });
  if (error) {
    logger.error("card_state_failed", { pgCode: error.code });
    throw new CardError("DB", parseDbError(error.message).message);
  }
  return storedCard(db, id);
}
