"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { CARD_COLUMNS, cardFromRow, type CardEnvelope } from "@/cards/envelope";
import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { EMPTY_FEED, feedReducer, messageFromRow, type FeedMessage } from "./feed";

const FEED_LIMIT = 100;
const MESSAGE_SELECT = `id, author_kind, body, card_id, created_at, card:card_instance!chat_message_card_fk (${CARD_COLUMNS})`;

export type FeedItem = { message: FeedMessage; card: CardEnvelope | null };
export type FeedStatus = "loading" | "ready" | "error";

/**
 * A thread's messages and cards: the latest 100 on first load (RLS applies), then Realtime inserts of
 * messages and inserts or updates of cards, so a superseded card changes in place on every device.
 */
export function useThreadFeed(threadId: string) {
  const [state, dispatch] = useReducer(feedReducer, EMPTY_FEED);
  const [status, setStatus] = useState<FeedStatus>("loading");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const fetchCard = async (id: string) => {
      const { data } = await supabase.from("card_instance").select(CARD_COLUMNS).eq("id", id).maybeSingle();
      const card = data ? cardFromRow(data) : null;
      if (active && card) dispatch({ type: "card", card, threadId });
    };

    const channel = supabase
      .channel(`thread:${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_message", filter: `thread_id=eq.${threadId}` }, (payload) => {
        const parsed = messageFromRow(payload.new);
        if (!parsed) return;
        dispatch({ type: "message", message: parsed.message });
        if (parsed.message.cardId) void fetchCard(parsed.message.cardId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "card_instance", filter: `thread_id=eq.${threadId}` }, (payload) => {
        const card = cardFromRow(payload.new);
        if (card) dispatch({ type: "card", card, threadId });
      })
      .subscribe();

    const load = async () => {
      const { data, error } = await supabase
        .from("chat_message")
        .select(MESSAGE_SELECT)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT);
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setStatus("error");
        return;
      }
      const rows = data.map(messageFromRow).filter((row) => row !== null);
      dispatch({
        type: "load",
        messages: rows.map((row) => row.message),
        cards: rows.map((row) => row.card).filter((card) => card !== null),
      });
      setStatus("ready");
    };
    void load();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  const upsertCard = useCallback((card: CardEnvelope) => dispatch({ type: "card", card, threadId }), [threadId]);

  const items = useMemo<FeedItem[]>(
    () => state.messages.map((message) => ({ message, card: message.cardId ? (state.cards[message.cardId] ?? null) : null })),
    [state],
  );

  return { items, status, upsertCard };
}
