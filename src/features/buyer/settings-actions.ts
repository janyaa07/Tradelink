"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { requireRole } from "@/data/session";
import type { ActionResult } from "@/lib/errors";

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/buyer", "layout");
  return result;
}

const settingsInput = z.object({
  weeklyBudget: z.number({ error: "Enter a budget above 0." }).gt(0, "Enter a budget above 0.").max(9999999, "Enter a budget above 0."),
  suggestReorder: z.boolean(),
  priceAlerts: z.boolean(),
  budgetWarning: z.boolean(),
});

/** Weekly budget and the three switches, shared by everyone in the business (BUY-43, BUY-44). */
export async function updateBuyerSettingsAction(input: z.infer<typeof settingsInput>): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a budget above 0." };
  return done(
    await callRpc("update_buyer_settings", {
      p_budget: Math.round(parsed.data.weeklyBudget * 100) / 100,
      p_suggest: parsed.data.suggestReorder,
      p_price_alerts: parsed.data.priceAlerts,
      p_budget_warning: parsed.data.budgetWarning,
    }),
  );
}

const usualInput = z.object({
  productId: z.uuid(),
  usualQty: z
    .number()
    .int("Enter a whole number between 1 and 9999.")
    .min(1, "Enter a whole number between 1 and 9999.")
    .max(9999, "Enter a whole number between 1 and 9999."),
  usePerDay: z
    .number({ error: "Enter how many you use per day, 0 or more." })
    .min(0, "Enter how many you use per day, 0 or more.")
    .max(9999, "Enter how many you use per day, 0 or more."),
  inShop: z
    .number({ error: "Enter how many you have, 0 or more." })
    .min(0, "Enter how many you have, 0 or more.")
    .max(999999, "Enter how many you have, 0 or more."),
});

/** Adds or updates a usual item: usual quantity, use per day and the count in the shop (BUY-46). */
export async function setUsualItemAction(input: z.infer<typeof usualInput>): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  const parsed = usualInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  return done(
    await callRpc("set_usual_item", {
      p_product: parsed.data.productId,
      p_usual_qty: parsed.data.usualQty,
      p_use_per_day: parsed.data.usePerDay,
      p_in_shop: parsed.data.inShop,
    }),
  );
}

export async function removeUsualItemAction(productId: string): Promise<ActionResult<unknown>> {
  await requireRole("buyer");
  if (!z.uuid().safeParse(productId).success) return { ok: false, error: "This record is not available." };
  return done(await callRpc("remove_usual_item", { p_product: productId }));
}
