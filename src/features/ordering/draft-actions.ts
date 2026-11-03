"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/data/session";
import type { ActionResult } from "@/lib/errors";
import { addLinesToDraft } from "./draft-store";

/** "+" on a product card outside review: adds one, marked "Added by you" (BUY-12, BUY-42). */
export async function addProductToDraftAction(productId: string): Promise<ActionResult<{ version: number }>> {
  const session = await requireRole("buyer");
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { ok: false, error: "This record is not available." };
  const result = await addLinesToDraft(session.userId, [
    { productId: parsed.data, qty: 1, sourceText: "Added by you", state: "manual" },
  ]);
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}
