import { CardError } from "../errors";
import type { CardAction } from "../envelope";
import type { CardDefinition } from "../types";
import { buildOrderSummary } from "./build";
import { OrderSummaryDataSchema, type OrderSummaryData } from "./schema";

/** Edit only opens the quantity steppers on the card; saving goes through the fields route. */
export const ORDER_ACTIONS = {
  confirm: { label: "Confirm order", style: "primary" },
  edit: { label: "Edit order", style: "secondary" },
  cancel: { label: "Cancel order", style: "danger" },
} as const satisfies Record<string, Pick<CardAction, "label" | "style">>;

const OPEN_STATES = new Set(["draft", "awaiting_confirm"]);

export const orderSummaryCard: CardDefinition<OrderSummaryData> = {
  type: "order_summary",
  schemaVersion: 1,
  subjectKinds: ["shop_order"],
  requiresReason: false,
  requiresQuestion: false,
  dataSchema: OrderSummaryDataSchema,

  build: buildOrderSummary,

  actions({ state, data }) {
    if (!OPEN_STATES.has(state)) return [];
    return [
      { id: "confirm", ...ORDER_ACTIONS.confirm, enabled: state === "awaiting_confirm" && data.needsPickCount === 0 },
      { id: "edit", ...ORDER_ACTIONS.edit, enabled: true },
      { id: "cancel", ...ORDER_ACTIONS.cancel, enabled: true },
    ];
  },

  act({ card, key }, actionId) {
    const args = { p_order: card.subject.id, p_version: card.subject.version, p_key: key };
    if (actionId === "confirm") return { name: "rs_order_confirm", args };
    if (actionId === "cancel") return { name: "rs_order_cancel", args };
    throw new CardError("ACTION_UNAVAILABLE", "That action is not available on this card.");
  },

  after() {
    return { kind: "rerender" };
  },

  revise({ card, key }, changes) {
    const data = OrderSummaryDataSchema.safeParse(card.data);
    const editable = new Set(
      data.success ? data.data.groups.flatMap((group) => group.lines.filter((line) => !line.needsPick).map((line) => line.lineId)) : [],
    );
    if (!OPEN_STATES.has(card.state) || changes.some((change) => !editable.has(change.lineId))) {
      throw new CardError("ACTION_UNAVAILABLE", "Those lines cannot be changed on this card.");
    }
    return {
      name: "rs_order_revise",
      args: {
        p_order: card.subject.id,
        p_version: card.subject.version,
        p_changes: changes.map((change) => ({ op: "qty", line_id: change.lineId, qty: change.qty })),
        p_key: key,
      },
    };
  },
};
