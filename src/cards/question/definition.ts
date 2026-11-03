import { z } from "zod";
import { formatDateTime } from "@/ui/format";
import { notFound, parseRows } from "../db";
import { CardError } from "../errors";
import { SUBJECT_KINDS, type CardAction, type CardQuestion } from "../envelope";
import type { BuildContext, CardDefinition, Hydrated } from "../types";
import { ANSWER_PREFIX, answerActionId, QuestionDataSchema, type QuestionData } from "./schema";

const OrderRow = z.object({ version: z.number().int(), created_at: z.string() }).nullable();
const PoRow = z.object({ version: z.number().int(), number: z.number().int() }).nullable();
const ActionRow = z.object({ id: z.string() }).nullable();
const ShopRow = z.object({ name: z.string() }).nullable();

async function subjectOf({ db, subject, shopId }: BuildContext): Promise<{ label: string; version: number }> {
  switch (subject.kind) {
    case "shop_order": {
      const row = parseRows(
        await db.from("shop_order").select("version, created_at").eq("id", subject.id).eq("shop_id", shopId).maybeSingle(),
        OrderRow,
        "order",
      );
      if (!row) throw notFound("order");
      return { label: `Order of ${formatDateTime(row.created_at)}`, version: row.version };
    }
    case "purchase_order": {
      const row = parseRows(
        await db.from("purchase_order").select("version, number").eq("id", subject.id).eq("shop_id", shopId).maybeSingle(),
        PoRow,
        "purchase order",
      );
      if (!row) throw notFound("purchase order");
      return { label: `Purchase order R-${row.number}`, version: row.version };
    }
    case "agent_action": {
      const row = parseRows(
        await db.from("agent_action").select("id").eq("id", subject.id).eq("shop_id", shopId).maybeSingle(),
        ActionRow,
        "agent action",
      );
      if (!row) throw notFound("agent action");
      return { label: "Something Tradelink AI did", version: 1 };
    }
    case "shop": {
      if (subject.id !== shopId) throw notFound("shop");
      const row = parseRows(await db.from("shop").select("name").eq("id", shopId).maybeSingle(), ShopRow, "shop");
      if (!row) throw notFound("shop");
      return { label: row.name, version: 1 };
    }
  }
}

function optionActions(question: CardQuestion | null, enabled: boolean, chosen?: string): CardAction[] {
  return (question?.options ?? []).map((option) => ({
    id: answerActionId(option.id),
    label: option.label,
    style: option.id === chosen ? "primary" : "secondary",
    enabled,
  }));
}

/** One short question with options, for medium confidence (US-70). The answer is recorded as an event in M0. */
export const questionCard: CardDefinition<QuestionData> = {
  type: "question",
  schemaVersion: 1,
  subjectKinds: SUBJECT_KINDS,
  requiresReason: false,
  requiresQuestion: true,
  dataSchema: QuestionDataSchema,

  async build(ctx): Promise<Hydrated<QuestionData>> {
    const subject = await subjectOf(ctx);
    return {
      data: { subjectLabel: subject.label },
      state: "open",
      subjectVersion: subject.version,
      audience: "shop",
      supplierId: null,
      expiresAt: null,
    };
  },

  actions({ state }, question) {
    return optionActions(question, state === "open");
  },

  act({ card, key }, actionId) {
    const optionId = actionId.startsWith(ANSWER_PREFIX) ? actionId.slice(ANSWER_PREFIX.length) : "";
    const option = card.question?.options.find((candidate) => candidate.id === optionId);
    if (!option || !card.shopId) throw new CardError("ACTION_UNAVAILABLE", "That answer is not on this card.");
    return {
      name: "rs_log_event",
      args: {
        p_name: "question.answered",
        p_shop: card.shopId,
        p_props: {
          card_id: card.id,
          subject_kind: card.subject.kind,
          subject_id: card.subject.id,
          option_id: option.id,
          label: option.label,
        },
        p_client_event_id: key,
      },
    };
  },

  after({ card }, actionId) {
    return { kind: "set_state", state: "done", actions: optionActions(card.question, false, actionId.slice(ANSWER_PREFIX.length)) };
  },
};
