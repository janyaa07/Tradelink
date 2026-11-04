import { z } from "zod";

/**
 * The card envelope stored in card_instance (docs/AI_DESIGN.md, section 4.3). Ids use z.guid() because the
 * demo rows use fixed ids that are not RFC 4122 variants.
 */

export const CARD_STATES = [
  "draft",
  "awaiting_confirm",
  "confirmed",
  "sent",
  "seen",
  "accepted",
  "partial",
  "rejected",
  "superseded",
  "expired",
  "done",
  "undone",
  "open",
] as const;
export const CardStateSchema = z.enum(CARD_STATES);
export type CardState = z.infer<typeof CardStateSchema>;

export const CARD_TYPES = ["order_summary", "agent_action_notice", "question"] as const;
export const CardTypeSchema = z.enum(CARD_TYPES);
export type CardType = z.infer<typeof CardTypeSchema>;

/** Rows a card can be about. Each has a shop_id, so a card is always scoped to one shop. */
export const SUBJECT_KINDS = ["shop_order", "agent_action", "purchase_order", "shop"] as const;
export const SubjectKindSchema = z.enum(SUBJECT_KINDS);
export type SubjectKind = z.infer<typeof SubjectKindSchema>;

export const SubjectSchema = z.object({
  kind: SubjectKindSchema,
  id: z.guid(),
  version: z.number().int().min(1),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const ACTION_ID = /^[a-z][a-z0-9_.-]{0,60}$/;

export const CardActionSchema = z.object({
  id: z.string().regex(ACTION_ID),
  label: z.string().min(1).max(40),
  style: z.enum(["primary", "secondary", "danger"]),
  enabled: z.boolean(),
});
export type CardAction = z.infer<typeof CardActionSchema>;

export const CardReasonSchema = z.object({
  text: z.string().trim().min(1).max(200),
  detailsHref: z.string().regex(/^\/(?!\/)[^\s\\]*$/).max(200).optional(),
});
export type CardReason = z.infer<typeof CardReasonSchema>;

export const QuestionOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,30}$/),
  label: z.string().trim().min(1).max(40),
});

export const CardQuestionSchema = z.object({
  text: z.string().trim().min(1).max(200),
  options: z
    .array(QuestionOptionSchema)
    .min(2)
    .max(4)
    .refine((options) => new Set(options.map((option) => option.id)).size === options.length, "Option ids must be unique."),
});
export type CardQuestion = z.infer<typeof CardQuestionSchema>;

export const CardAudienceSchema = z.enum(["shop", "supplier", "ops"]);
export type CardAudience = z.infer<typeof CardAudienceSchema>;

export const CardSurfaceSchema = z.enum(["chat", "alerts", "screen"]);

export const CardEnvelopeSchema = z.object({
  id: z.guid(),
  type: CardTypeSchema,
  schemaVersion: z.number().int().min(1),
  audience: CardAudienceSchema,
  shopId: z.guid().nullable(),
  supplierId: z.guid().nullable(),
  subject: SubjectSchema,
  state: CardStateSchema,
  data: z.record(z.string(), z.unknown()),
  actions: z.array(CardActionSchema),
  reason: CardReasonSchema.nullable(),
  question: CardQuestionSchema.nullable(),
  surfaces: z.array(CardSurfaceSchema),
  threadId: z.guid().nullable(),
  supersededBy: z.guid().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CardEnvelope = z.infer<typeof CardEnvelopeSchema>;

/** Columns read for a card, in the order cardFromRow expects. */
export const CARD_COLUMNS =
  "id, type, schema_version, audience, shop_id, supplier_id, subject_kind, subject_id, subject_version, state, data, actions, reason, question, surfaces, thread_id, superseded_by, expires_at, created_at, updated_at";

const CardRowSchema = z.object({
  id: z.string(),
  type: z.string(),
  schema_version: z.number(),
  audience: z.string(),
  shop_id: z.string().nullable(),
  supplier_id: z.string().nullable(),
  subject_kind: z.string(),
  subject_id: z.string(),
  subject_version: z.number(),
  state: z.string(),
  data: z.unknown(),
  actions: z.unknown(),
  reason: z.unknown(),
  question: z.unknown(),
  surfaces: z.array(z.string()),
  thread_id: z.string().nullable(),
  superseded_by: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** A card_instance row (from a query or a Realtime payload) as an envelope, or null when it is malformed. */
export function cardFromRow(row: unknown): CardEnvelope | null {
  const raw = CardRowSchema.safeParse(row);
  if (!raw.success) return null;
  const r = raw.data;
  const parsed = CardEnvelopeSchema.safeParse({
    id: r.id,
    type: r.type,
    schemaVersion: r.schema_version,
    audience: r.audience,
    shopId: r.shop_id,
    supplierId: r.supplier_id,
    subject: { kind: r.subject_kind, id: r.subject_id, version: r.subject_version },
    state: r.state,
    data: r.data,
    actions: r.actions ?? [],
    reason: r.reason ?? null,
    question: r.question ?? null,
    surfaces: r.surfaces,
    threadId: r.thread_id,
    supersededBy: r.superseded_by,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  return parsed.success ? parsed.data : null;
}

/** True when the card no longer accepts taps: a newer card replaced it, or its time ran out. */
export function isCardStale(card: CardEnvelope, now: Date = new Date()): boolean {
  if (card.state === "superseded" || card.supersededBy !== null) return true;
  return card.expiresAt !== null && new Date(card.expiresAt).getTime() <= now.getTime();
}
