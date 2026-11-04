import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";

/** The order a problem is on, read through RLS, so another business's problem looks missing. */
export async function orderOfIssue(issueId: string): Promise<string | null> {
  if (!z.uuid().safeParse(issueId).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("issues").select("order_id").eq("id", issueId).maybeSingle();
  const parsed = z.object({ order_id: z.uuid() }).safeParse(data);
  return parsed.success ? parsed.data.order_id : null;
}
