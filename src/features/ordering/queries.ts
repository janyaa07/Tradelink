import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
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
