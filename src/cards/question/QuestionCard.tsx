"use client";

import { useMemo, useState } from "react";
import type { CardEnvelope } from "@/cards/envelope";
import { useCardAction } from "@/features/cards/useCardAction";
import { CardActionBar, CardShell } from "@/ui/cards/CardShell";
import { QuestionDataSchema } from "./schema";

type Props = { card: CardEnvelope; onUpdate: (card: CardEnvelope) => void };

/** One short question with its options as buttons (US-70). The chosen option stays highlighted. */
export function QuestionCard({ card, onUpdate }: Props) {
  const { pending, act } = useCardAction(card, onUpdate);
  const parsed = useMemo(() => QuestionDataSchema.safeParse(card.data), [card.data]);
  const [chosen, setChosen] = useState<{ at: string; id: string } | null>(null);
  const optimistic = chosen?.at === card.updatedAt ? chosen.id : null;

  const onAction = async (id: string) => {
    setChosen({ at: card.updatedAt, id });
    if (!(await act(id))) setChosen(null);
  };

  const actions = optimistic
    ? card.actions.map((action) => ({ ...action, enabled: false, style: action.id === optimistic ? ("primary" as const) : ("secondary" as const) }))
    : card.actions;

  return (
    <CardShell
      card={card}
      title="Quick question"
      subjectLabel={parsed.success ? parsed.data.subjectLabel : undefined}
      state={optimistic ? "done" : undefined}
      stateLabel={optimistic || card.state === "done" ? "Answered" : undefined}
      footerActions={<CardActionBar actions={actions} onAction={(id) => void onAction(id)} pending={pending} />}
    >
      <p className="text-[1rem] font-semibold [overflow-wrap:anywhere]">{card.question?.text ?? "This question is no longer available."}</p>
    </CardShell>
  );
}
