import "server-only";
import { z } from "zod";

type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** PostgREST returns at most 1000 rows per request; page through until a short page. */
const PAGE = 1000;

export async function selectAll<T extends z.ZodType>(
  schema: T,
  what: string,
  page: (from: number, to: number) => Result,
): Promise<z.infer<T>[]> {
  const rows: z.infer<T>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load ${what}: ${error.message}`);
    const batch = z.array(schema).parse(data);
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

export async function selectRows<T extends z.ZodType>(schema: T, what: string, query: Result): Promise<z.infer<T>[]> {
  const { data, error } = await query;
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  return z.array(schema).parse(data);
}

export async function selectMaybe<T extends z.ZodType>(schema: T, what: string, query: Result): Promise<z.infer<T> | null> {
  const { data, error } = await query;
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  return data === null ? null : schema.parse(data);
}

export const money = z.union([z.string(), z.number()]);
