import { z } from "zod";
import { notFound, parseRows } from "../db";
import { CardError } from "../errors";
import type { CardDefinition } from "../types";
import { AgentActionNoticeDataSchema, type AgentActionNoticeData } from "./schema";

const ActionRowSchema = z
  .object({
    id: z.string(),
    action: z.string(),
    inputs: z.record(z.string(), z.unknown()).nullable(),
    undo_until: z.string().nullable(),
    undone_at: z.string().nullable(),
    created_at: z.string(),
  })
  .nullable();

/** The logged summary when there is one (written by the server, never by the model), else the action name. */
export function noticeText(action: string, inputs: Record<string, unknown> | null): string {
  const summary = inputs?.summary;
  if (typeof summary === "string" && summary.trim()) return summary.trim().slice(0, 240);
  return `Tradelink AI did this for you: ${action.replaceAll(/[._]/g, " ")}.`;
}

export function canUndo(data: AgentActionNoticeData, now: Date): boolean {
  return data.undoneAt === null && data.undoUntil !== null && new Date(data.undoUntil).getTime() > now.getTime();
}

export const agentActionNoticeCard: CardDefinition<AgentActionNoticeData> = {
  type: "agent_action_notice",
  schemaVersion: 1,
  subjectKinds: ["agent_action"],
  requiresReason: true,
  requiresQuestion: false,
  dataSchema: AgentActionNoticeDataSchema,

  async build({ db, subject, shopId }) {
    const row = parseRows(
      await db
        .from("agent_action")
        .select("id, action, inputs, undo_until, undone_at, created_at")
        .eq("id", subject.id)
        .eq("shop_id", shopId)
        .maybeSingle(),
      ActionRowSchema,
      "agent action",
    );
    if (!row) throw notFound("agent action");
    return {
      data: {
        actionId: row.id,
        text: noticeText(row.action, row.inputs),
        undoUntil: row.undo_until,
        undoneAt: row.undone_at,
        createdAt: row.created_at,
      },
      state: row.undone_at ? "undone" : "done",
      subjectVersion: 1,
      audience: "shop",
      supplierId: null,
      expiresAt: row.undone_at ? null : row.undo_until,
    };
  },

  actions({ data }, _question, now) {
    return canUndo(data, now) ? [{ id: "undo", label: "Undo", style: "secondary", enabled: true }] : [];
  },

  act({ card, key }, actionId) {
    if (actionId !== "undo") throw new CardError("ACTION_UNAVAILABLE", "That action is not available on this card.");
    return { name: "rs_undo_agent_action", args: { p_action: card.subject.id, p_key: key } };
  },

  after() {
    return { kind: "rerender" };
  },
};
