import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";

const MembershipSchema = z.object({
  shop_id: z.string(),
  role: z.enum(["owner", "staff"]),
  shop: z.object({ name: z.string() }).nullable(),
});

export type MyShop = { userId: string; shopId: string; shopName: string; role: "owner" | "staff" };

/** The signed-in person's active Tradelink AI shop (RLS: their own membership rows), or null. */
export const getMyShop = cache(async (): Promise<MyShop | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("shop_member")
    .select("shop_id, role, shop:shop_id (name)")
    .eq("user_id", auth.user.id)
    .eq("status", "ACTIVE")
    .order("role")
    .limit(1)
    .maybeSingle();
  const parsed = MembershipSchema.safeParse(data);
  if (!parsed.success) return null;
  return { userId: auth.user.id, shopId: parsed.data.shop_id, shopName: parsed.data.shop?.name ?? "Your shop", role: parsed.data.role };
});

/** Tradelink AI's dev pages: never in production unless TRADELINK_AI_DEV_PAGES=1. */
export function devPagesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.TRADELINK_AI_DEV_PAGES === "1";
}
