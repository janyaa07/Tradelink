import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_COLUMNS, cardFromRow, type CardEnvelope } from "@/cards/envelope";
import { logger } from "@/lib/logger";

/** One card, as the given client sees it (RLS applies for the user's client). */
export async function loadCard(db: SupabaseClient, id: string): Promise<CardEnvelope | null> {
  const { data, error } = await db.from("card_instance").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  if (error) logger.error("card_load_failed", { pgCode: error.code });
  return data ? cardFromRow(data) : null;
}

/** The newest card of the same type for the same subject that nothing has replaced yet. */
export async function loadLatestCard(db: SupabaseClient, card: CardEnvelope): Promise<CardEnvelope | null> {
  const { data, error } = await db
    .from("card_instance")
    .select(CARD_COLUMNS)
    .eq("type", card.type)
    .eq("subject_kind", card.subject.kind)
    .eq("subject_id", card.subject.id)
    .is("superseded_by", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) logger.error("card_load_failed", { pgCode: error.code });
  return data ? cardFromRow(data) : null;
}
