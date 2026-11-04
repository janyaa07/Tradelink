import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACTION_ID, isCardStale, type CardEnvelope } from "@/cards/envelope";
import { CardError } from "@/cards/errors";
import { getCardDefinition } from "@/cards/registry";
import type { CardResponseBody } from "@/cards/response";
import type { ActContext, AfterAct, CardDefinition, RpcCall } from "@/cards/types";
import { callRpc } from "@/data/rpc";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { messageFor } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadCard, loadLatestCard } from "./queries";
import { renderCard, setCardState } from "./render";

export const ActBodySchema = z.object({
  action: z.string().regex(ACTION_ID),
  subjectVersion: z.number().int().min(1),
  clientActionId: z.uuid(),
  input: z.unknown().optional(),
});

export const FieldsBodySchema = z.object({
  subjectVersion: z.number().int().min(1),
  clientActionId: z.uuid(),
  changes: z
    .array(z.object({ lineId: z.guid(), qty: z.number().int().min(1).max(9999) }))
    .min(1)
    .max(60),
});

export type CardResponse = { status: number; body: CardResponseBody };

const STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_SIGNED_IN: 401,
  UNAUTHENTICATED: 401,
  NOT_ALLOWED: 403,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  STALE_VERSION: 409,
  NOT_READY: 409,
  INVALID_TRANSITION: 409,
  UNDO_EXPIRED: 409,
};

const REFRESH_LATER = "Saved. The card will update shortly.";
const EXPIRED = "This has expired. Here's the latest.";

function fail(status: number, error: string, reason?: string, latest?: CardEnvelope | null): CardResponse {
  return { status, body: { ok: false, error, reason, ...(latest === undefined ? {} : { latest }) } };
}

/** The card to show after a stale tap: a newer stored card, or a fresh render of the subject as it is now. */
async function latestFor(db: SupabaseClient, card: CardEnvelope): Promise<CardEnvelope> {
  const latest = await loadLatestCard(db, card);
  if (latest && latest.id !== card.id) return latest;
  if (!card.shopId) return latest ?? card;
  try {
    return await renderCard({
      type: card.type,
      subject: card.subject,
      shopId: card.shopId,
      threadId: card.threadId,
      question: card.question,
      createdBy: "system",
    });
  } catch (error) {
    if (!(error instanceof CardError)) throw error;
    logger.warn("card_latest_render_failed", { reason: error.reason });
    return latest ?? card;
  }
}

async function refreshed(card: CardEnvelope, after: AfterAct): Promise<CardResponse> {
  try {
    const next =
      after.kind === "set_state"
        ? await setCardState(card.id, after.state, after.actions)
        : await renderCard({
            type: card.type,
            subject: card.subject,
            shopId: card.shopId ?? "",
            threadId: card.threadId,
            question: card.question,
            createdBy: "user",
          });
    return { status: 200, body: { ok: true, card: next } };
  } catch (error) {
    if (!(error instanceof CardError)) throw error;
    logger.warn("card_refresh_failed", { reason: error.reason });
    return { status: 200, body: { ok: true, card: null, message: REFRESH_LATER } };
  }
}

type Plan = (definition: CardDefinition<unknown>, ctx: ActContext) => { call: RpcCall; after: AfterAct };

/**
 * One tap or edit on a card (docs/AI_DESIGN.md, section 4.4): the card is loaded as the user (RLS), a
 * superseded, expired or older card is refused with the latest one, and the mapped function runs as
 * the user with p_key = clientActionId and p_version = subjectVersion.
 */
async function runCardWrite(cardId: string, subjectVersion: number, key: string, plan: Plan): Promise<CardResponse> {
  if (!z.guid().safeParse(cardId).success) return fail(404, messageFor("NOT_FOUND"), "NOT_FOUND");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(401, messageFor("NOT_SIGNED_IN"), "NOT_SIGNED_IN");

  const card = await loadCard(supabase, cardId);
  if (!card || !card.shopId) return fail(404, messageFor("NOT_FOUND"), "NOT_FOUND");
  if (isCardStale(card)) {
    const replaced = card.state === "superseded" || card.supersededBy !== null;
    return fail(409, replaced ? messageFor("STALE_VERSION") : EXPIRED, replaced ? "STALE_CARD" : "EXPIRED", await latestFor(supabase, card));
  }
  // The tap was made on an older copy of this card than the one stored.
  if (card.subject.version !== subjectVersion) return fail(409, messageFor("STALE_VERSION"), "STALE_CARD", card);

  const ctx: ActContext = { card, key };
  let planned: ReturnType<Plan>;
  try {
    planned = plan(getCardDefinition(card.type), ctx);
  } catch (error) {
    if (error instanceof CardError) return fail(400, error.message, error.reason);
    throw error;
  }

  const result = await callRpc(planned.call.name, planned.call.args);
  if (!result.ok) {
    if (result.reason === "STALE_VERSION") return fail(409, result.error, result.reason, await latestFor(supabase, card));
    return fail(STATUS[result.reason ?? ""] ?? 500, result.error, result.reason);
  }
  revalidatePath("/r", "layout");
  return refreshed(card, planned.after);
}

export async function actOnCard(cardId: string, body: unknown): Promise<CardResponse> {
  const parsed = ActBodySchema.safeParse(body);
  if (!parsed.success) return fail(400, messageFor("INVALID_INPUT"), "INVALID_INPUT");
  const { action, subjectVersion, clientActionId, input } = parsed.data;
  return runCardWrite(cardId, subjectVersion, clientActionId, (definition, ctx) => {
    const button = ctx.card.actions.find((candidate) => candidate.id === action);
    if (!button?.enabled) throw new CardError("ACTION_UNAVAILABLE", "That action is not available on this card.");
    return { call: definition.act(ctx, action, input), after: definition.after(ctx, action) };
  });
}

export async function reviseCardFields(cardId: string, body: unknown): Promise<CardResponse> {
  const parsed = FieldsBodySchema.safeParse(body);
  if (!parsed.success) return fail(400, messageFor("INVALID_INPUT"), "INVALID_INPUT");
  const { subjectVersion, clientActionId, changes } = parsed.data;
  return runCardWrite(cardId, subjectVersion, clientActionId, (definition, ctx) => {
    if (!definition.revise) throw new CardError("ACTION_UNAVAILABLE", "This card has no fields to change.");
    return { call: definition.revise(ctx, changes), after: { kind: "rerender" } };
  });
}
