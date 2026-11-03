import { z } from "zod";
import { CardEnvelopeSchema } from "./envelope";

/** The body of POST /api/cards/:id/act and /fields, checked again by the client. */
export const CardResponseBodySchema = z.union([
  z.object({ ok: z.literal(true), card: CardEnvelopeSchema.nullable(), message: z.string().optional() }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    reason: z.string().optional(),
    latest: CardEnvelopeSchema.nullable().optional(),
  }),
]);
export type CardResponseBody = z.infer<typeof CardResponseBodySchema>;
