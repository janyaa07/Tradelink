import type { z } from "zod";
import { logger } from "@/lib/logger";
import { CardError } from "./errors";

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

/** The rows of a read, checked against a schema. A failed read or an unexpected shape is a CardError. */
export function parseRows<T>(result: QueryResult, schema: z.ZodType<T>, label: string): T {
  if (result.error) {
    logger.error("card_read_failed", { table: label, pgCode: result.error.code ?? null });
    throw new CardError("DB", `Could not read ${label}.`);
  }
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    logger.error("card_read_unexpected", { table: label });
    throw new CardError("DB", `Unexpected ${label} data.`);
  }
  return parsed.data;
}

export function notFound(label: string): CardError {
  return new CardError("NOT_FOUND", `No ${label} with that id in this shop.`);
}
