"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, roleOf } from "@/data/session";
import type { ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { toolsFor } from "./agent";
import { cardKeys } from "./cards";

const proposalInput = z.object({
  id: z.uuid(),
  tool: z.string().regex(/^[a-z_]{2,40}$/),
  args: z.record(z.string(), z.unknown()),
});

/**
 * The person tapped Confirm on a Tradelink AI card. The arguments are checked again here and the
 * change runs as them through the same database functions as the app's own buttons, with the
 * proposal id as the idempotency key, so a second tap does nothing twice.
 */
export async function executeAiAction(input: z.infer<typeof proposalInput>): Promise<ActionResult<string>> {
  const session = await getSession();
  const role = session ? roleOf(session.kind) : null;
  if (!session || (role !== "buyer" && role !== "supplier")) return { ok: false, error: "Sign in again to do this." };
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This card can no longer be used. Ask again." };

  const tool = toolsFor(role).find((entry) => entry.name === parsed.data.tool);
  if (!tool || tool.kind !== "write") return { ok: false, error: "This card can no longer be used. Ask again." };
  const args = tool.input.safeParse(parsed.data.args);
  if (!args.success) return { ok: false, error: "This card can no longer be used. Ask again." };
  const orderId = z.uuid().optional().safeParse(parsed.data.args.order_id);

  const result = await tool.exec(
    { session, role, now: new Date(), cardKey: cardKeys() },
    { ...(args.data as Record<string, unknown>), ...(orderId.success && orderId.data ? { order_id: orderId.data } : {}) },
    parsed.data.id,
  );
  logger.info("ai_action", { tool: tool.name, role, ok: result.ok });
  if (result.ok) revalidatePath(`/${role}`, "layout");
  return result;
}
