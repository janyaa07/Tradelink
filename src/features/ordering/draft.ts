import { z } from "zod";

export const DRAFT_STATES = ["matched", "check", "not_found", "added", "suggested", "manual"] as const;
export type DraftState = (typeof DRAFT_STATES)[number];

/** One line in the buyer's cart. Saved to order_drafts so the cart survives reloads and devices. */
export const draftLineSchema = z.object({
  id: z.string().min(1).max(64),
  sourceText: z.string().max(240),
  productId: z.uuid().nullable(),
  qty: z.number().int().min(1).max(9999),
  kg: z.number().positive().nullable(),
  qtyAssumed: z.boolean(),
  options: z.array(z.uuid()).max(5),
  state: z.enum(DRAFT_STATES),
});

export type DraftLine = z.infer<typeof draftLineSchema>;

export const draftSchema = z.object({
  lines: z.array(draftLineSchema).max(60),
  version: z.number().int().min(0),
});

export type Draft = z.infer<typeof draftSchema>;
