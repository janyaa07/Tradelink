"use client";

import { useCallback, useState } from "react";
import type { CardEnvelope } from "@/cards/envelope";
import { CardResponseBodySchema, type CardResponseBody } from "@/cards/response";
import { enqueueAndSend } from "@/offline/useOutbox";
import type { FieldChange } from "@/cards/types";
import { useToast } from "@/ui/Toast";

const QUEUED = "You are offline. This will send when you reconnect.";
const UNEXPECTED = "Something went wrong. Try again.";

/**
 * Sends one tap through the offline outbox. The body, and so its clientActionId, is fixed for the
 * tap, so a replay after reconnecting is the same request and the server's idempotency key makes it
 * count once (EC06); the version check still refuses it if the card moved on meanwhile (EC08).
 */
async function sendTap(kind: "card_action" | "card_fields", url: string, body: Record<string, unknown>): Promise<CardResponseBody | "queued"> {
  const clientId = String(body.clientActionId);
  const outcome = await enqueueAndSend({ clientId, kind, url, body: JSON.parse(JSON.stringify(body)), createdAt: new Date().toISOString() });
  if (outcome.result === "queued") return "queued";
  const parsed = CardResponseBodySchema.safeParse(outcome.body ?? null);
  return parsed.success ? parsed.data : { ok: false, error: UNEXPECTED };
}

export type CardActionApi = {
  /** The action id or "fields" while a request is in flight. */
  pending: string | null;
  /** Sends a button tap. Resolves true when the server accepted it. */
  act: (action: string, input?: unknown) => Promise<boolean>;
  saveFields: (changes: FieldChange[]) => Promise<boolean>;
};

/** Sends taps and edits for one card, shows the server's message on refusal and passes on the latest card. */
export function useCardAction(card: CardEnvelope, onUpdate: (card: CardEnvelope) => void): CardActionApi {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const send = useCallback(
    async (path: "act" | "fields", name: string, body: Record<string, unknown>): Promise<boolean> => {
      setPending(name);
      try {
        const result = await sendTap(path === "act" ? "card_action" : "card_fields", `/api/cards/${card.id}/${path}`, {
          ...body,
          subjectVersion: card.subject.version,
          clientActionId: crypto.randomUUID(),
        });
        if (result === "queued") {
          toast.show(QUEUED);
          return true;
        }
        if (result.ok) {
          if (result.card) onUpdate(result.card);
          if (result.message) toast.show(result.message);
          return true;
        }
        toast.show(result.error);
        if (result.latest) onUpdate(result.latest);
        return false;
      } finally {
        setPending(null);
      }
    },
    [card.id, card.subject.version, onUpdate, toast],
  );

  const act = useCallback((action: string, input?: unknown) => send("act", action, { action, input }), [send]);
  const saveFields = useCallback((changes: FieldChange[]) => send("fields", "fields", { changes }), [send]);
  return { pending, act, saveFields };
}
