"use client";

import { useEffect, useMemo, useState } from "react";
import type { CardEnvelope } from "@/cards/envelope";
import { useCardAction } from "@/features/cards/useCardAction";
import { CardActionBar, CardShell } from "@/ui/cards/CardShell";
import { formatCountdown } from "@/ui/cards/format";
import { formatDateTime } from "@/ui/format";
import { AgentActionNoticeDataSchema, type AgentActionNoticeData } from "./schema";

type Props = { card: CardEnvelope; onUpdate: (card: CardEnvelope) => void };

const TICK_MS = 1000;

/** Milliseconds left to undo, ticking every second until the window closes. */
function useUndoTimeLeft(undoUntil: string | null): number {
  const deadline = undoUntil ? new Date(undoUntil).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= deadline) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [deadline]);
  return Math.max(0, deadline - now);
}

function NoticeBody({ card, data, onUpdate }: Props & { data: AgentActionNoticeData }) {
  const { pending, act } = useCardAction(card, onUpdate);
  const [undoneAt, setUndoneAt] = useState<string | null>(null);
  const left = useUndoTimeLeft(data.undoUntil);
  const optimisticUndo = undoneAt === card.updatedAt;
  const open = left > 0 && card.state === "done" && !optimisticUndo;

  const onAction = async (id: string) => {
    if (id !== "undo") return;
    setUndoneAt(card.updatedAt);
    if (!(await act("undo"))) setUndoneAt(null);
  };

  const actions = card.actions.map((action) => (action.id === "undo" ? { ...action, enabled: action.enabled && open } : action));
  return (
    <CardShell
      card={card}
      title="Restock did this for you"
      subjectLabel={formatDateTime(data.createdAt)}
      state={optimisticUndo ? "undone" : undefined}
      footerActions={
        <CardActionBar
          actions={actions}
          onAction={(id) => void onAction(id)}
          pending={pending}
          labels={{ undo: open ? `Undo (${formatCountdown(left)} left)` : "Undo" }}
        />
      }
    >
      <p className="[overflow-wrap:anywhere]">{data.text}</p>
      {data.undoUntil && !open && card.state === "done" && !optimisticUndo ? (
        <p className="text-[.82rem] text-muted">This can no longer be undone.</p>
      ) : null}
    </CardShell>
  );
}

/** A notice for something Restock did, with Undo while its undo window is open (US-71). */
export function AgentActionNoticeCard({ card, onUpdate }: Props) {
  const parsed = useMemo(() => AgentActionNoticeDataSchema.safeParse(card.data), [card.data]);
  if (!parsed.success) {
    return (
      <CardShell card={card} title="Restock did this for you">
        <p className="text-muted">This card could not be shown. Refresh to try again.</p>
      </CardShell>
    );
  }
  return <NoticeBody card={card} data={parsed.data} onUpdate={onUpdate} />;
}
