"use client";

import { useCallback, useSyncExternalStore } from "react";
import { IndexedDbOutboxStorage } from "./indexedDbStorage";
import { fetchSender, MemoryOutboxStorage, Outbox, type OutboxItem } from "./outbox";

const LOCK_NAME = "tradelink-ai-outbox";

/** What happened to one item: sent now, refused by the server (roll back), or queued for later. */
export type SendOutcome =
  | { result: "sent"; status: number; body?: unknown }
  | { result: "dropped"; status: number; body?: unknown }
  | { result: "queued" };

let shared: Outbox | null = null;

function withWebLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(LOCK_NAME, run);
  return run();
}

/** The page's single outbox. It flushes once on start and again whenever the device comes back online. */
export function getOutbox(): Outbox {
  if (shared) return shared;
  const outbox = new Outbox({
    storage: typeof indexedDB === "undefined" ? new MemoryOutboxStorage() : new IndexedDbOutboxStorage(),
    send: fetchSender,
    isOnline: () => navigator.onLine,
    withLock: withWebLock,
  });
  shared = outbox;
  window.addEventListener("online", () => void outbox.flush({ force: true }).catch(() => undefined));
  void outbox.flush().catch(() => undefined);
  return outbox;
}

/**
 * Stores the item, then sends it at once when online. Callers render the change optimistically with
 * the same client id, so a replay after reconnecting is de-duplicated by the server (EC06).
 */
export async function enqueueAndSend(item: OutboxItem): Promise<SendOutcome> {
  const outbox = getOutbox();
  await outbox.enqueue(item);
  if (!navigator.onLine) return { result: "queued" };
  const report = await outbox.flush();
  const outcome = report.outcomes.find((entry) => entry.clientId === item.clientId);
  if (!outcome || outcome.result === "retry") return { result: "queued" };
  return { result: outcome.result, status: outcome.status, body: outcome.body };
}

const subscribe = (listener: () => void) => getOutbox().subscribe(listener);
const pendingSnapshot = () => getOutbox().pendingCount;
const serverSnapshot = () => 0;

export function useOutbox() {
  const pending = useSyncExternalStore(subscribe, pendingSnapshot, serverSnapshot);
  const flush = useCallback(() => getOutbox().flush({ force: true }), []);
  return { pending, enqueueAndSend, flush };
}
