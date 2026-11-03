"use client";

import { CardShell } from "@/ui/cards/CardShell";
import { AgentActionNoticeCard } from "./agent_action_notice/AgentActionNoticeCard";
import type { CardEnvelope } from "./envelope";
import { OrderSummaryCard } from "./order_summary/OrderSummaryCard";
import { QuestionCard } from "./question/QuestionCard";

type Props = {
  card: CardEnvelope;
  /** Receives the latest card after a tap, so the feed can show it at once. */
  onUpdate: (card: CardEnvelope) => void;
};

/** Picks the component for a card type. The same component renders in chat, Alerts and screens. */
export function CardRenderer({ card, onUpdate }: Props) {
  switch (card.type) {
    case "order_summary":
      return <OrderSummaryCard card={card} onUpdate={onUpdate} />;
    case "agent_action_notice":
      return <AgentActionNoticeCard card={card} onUpdate={onUpdate} />;
    case "question":
      return <QuestionCard card={card} onUpdate={onUpdate} />;
    default:
      return (
        <CardShell card={card} title="Card">
          <p className="text-muted">Update the app to see this card.</p>
        </CardShell>
      );
  }
}
