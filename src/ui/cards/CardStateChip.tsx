import type { CardState } from "@/cards/envelope";
import { Pill, type PillTone } from "@/ui/Pill";

export const CARD_STATE_CHIPS: Record<CardState, { label: string; tone: PillTone }> = {
  draft: { label: "Draft", tone: "plain" },
  awaiting_confirm: { label: "Waiting for you", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "good" },
  sent: { label: "Sent", tone: "info" },
  seen: { label: "Seen", tone: "info" },
  accepted: { label: "Accepted", tone: "good" },
  partial: { label: "Partly accepted", tone: "warn" },
  rejected: { label: "Rejected", tone: "bad" },
  superseded: { label: "Updated", tone: "plain" },
  expired: { label: "Expired", tone: "plain" },
  done: { label: "Done", tone: "good" },
  undone: { label: "Undone", tone: "plain" },
  open: { label: "Needs an answer", tone: "warn" },
};

type Props = {
  state: CardState;
  /** Replaces the state's word where the subject has a more exact one, such as "Cancelled". */
  label?: string;
};

export function CardStateChip({ state, label }: Props) {
  const chip = CARD_STATE_CHIPS[state];
  return <Pill tone={label ? "plain" : chip.tone}>{label ?? chip.label}</Pill>;
}
