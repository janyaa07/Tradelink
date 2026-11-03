import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { formatMoney, toCents } from "@/domain/money";
import type { CartSummary } from "@/ui/shell/types";
import { draftLineSchema, type Draft, type DraftLine } from "./draft";

const draftRowSchema = z.object({ lines: z.unknown(), version: z.number().int().min(0) });

/** Keeps only lines that still fit the schema, so one bad line never loses the whole draft. */
function validLines(raw: unknown): DraftLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((line) => {
    const parsed = draftLineSchema.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The signed-in buyer's saved order draft (RLS: own row only), read fresh. */
export async function readDraft(userId: string): Promise<Draft> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("order_drafts").select("lines, version").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Could not load the order draft: ${error.message}`);
  if (!data) return { lines: [], version: 0 };
  const row = draftRowSchema.parse(data);
  return { lines: validLines(row.lines).slice(0, 60), version: row.version };
}

/** The draft for rendering, cached per request so the layout and page share one read. */
export const getDraft = cache(readDraft);

const priceRowSchema = z.object({ id: z.uuid(), price: z.union([z.string(), z.number()]) });

/** CartBar: "{n} items", the total of lines with a product, and the link to review (BUY-23). */
export async function getCartSummary(userId: string): Promise<CartSummary | null> {
  const { lines } = await getDraft(userId);
  if (lines.length === 0) return null;
  const ids = [...new Set(lines.flatMap((line) => (line.productId ? [line.productId] : [])))];
  const prices = new Map<string, number>();
  if (ids.length > 0) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("products").select("id, price").in("id", ids);
    if (error) throw new Error(`Could not load cart prices: ${error.message}`);
    for (const row of z.array(priceRowSchema).parse(data)) prices.set(row.id, toCents(Number(row.price)));
  }
  const total = lines.reduce((sum, line) => sum + (line.productId ? (prices.get(line.productId) ?? 0) * line.qty : 0), 0);
  return { count: lines.length, totalLabel: formatMoney(total), href: "/buyer/order" };
}
