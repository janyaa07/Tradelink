import { z } from "zod";

/**
 * The offline outbox (docs/AI_DESIGN.md, section 4.7; ADR 0016). Messages and card taps are stored with the
 * client id the caller already shows optimistically, then POSTed in order. The server de-duplicates by
 * that id (EC06) and still checks card versions, so a replay can never apply twice or apply to a stale card.
 * Storage sits behind `OutboxStorage`: IndexedDB in the browser, memory in tests.
 */

export const OUTBOX_KINDS = ["chat_message", "card_action", "card_fields", "event"] as const;
export type OutboxKind = (typeof OUTBOX_KINDS)[number];

export const outboxItemSchema = z.object({
  clientId: z.uuid(),
  kind: z.enum(OUTBOX_KINDS),
  // Same-origin paths only: a queued body must never be sent to another site.
  url: z.string().regex(/^\/(?![/\\])/, "Use a path on this site."),
  body: z.json(),
  createdAt: z.iso.datetime({ offset: true }),
});

export type OutboxItem = z.infer<typeof outboxItemSchema>;

export type QueuedItem = OutboxItem & {
  /** Send order. */
  seq: number;
  /** Failed attempts so far. */
  attempts: number;
  /** Epoch milliseconds before which the item is not retried. */
  nextAttemptAt: number;
};

export interface OutboxStorage {
  /** Adds the item unless one with the same client id is stored. Resolves false for a duplicate. */
  add(item: QueuedItem): Promise<boolean>;
  update(item: QueuedItem): Promise<void>;
  remove(clientId: string): Promise<void>;
  /** Every stored item, oldest first. */
  list(): Promise<QueuedItem[]>;
}

export class MemoryOutboxStorage implements OutboxStorage {
  private readonly items = new Map<string, QueuedItem>();

  async add(item: QueuedItem): Promise<boolean> {
    if (this.items.has(item.clientId)) return false;
    this.items.set(item.clientId, { ...item });
    return true;
  }

  async update(item: QueuedItem): Promise<void> {
    this.items.set(item.clientId, { ...item });
  }

  async remove(clientId: string): Promise<void> {
    this.items.delete(clientId);
  }

  async list(): Promise<QueuedItem[]> {
    return sortBySeq([...this.items.values()].map((item) => ({ ...item })));
  }
}

export function sortBySeq(items: QueuedItem[]): QueuedItem[] {
  return items.sort((a, b) => a.seq - b.seq);
}

export type SendResponse = { status: number; body?: unknown };
/** Sends one item. Throws on a network error. */
export type Sender = (item: OutboxItem) => Promise<SendResponse>;

export const BASE_BACKOFF_MS = 1000;
export const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Wait before the next try after `attempts` failures: 1s, 2s, 4s and so on, capped at 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

/**
 * 2xx: done. 408 and 429: try again later. Any other 4xx (a refused tap, a stale version, a duplicate):
 * drop, since sending it again cannot succeed. 5xx and anything else, such as a sign-in redirect
 * (status 0 with `redirect: "manual"`): try again later.
 */
export function classifyStatus(status: number): "sent" | "dropped" | "retry" {
  if (status >= 200 && status < 300) return "sent";
  if (status === 408 || status === 429) return "retry";
  if (status >= 400 && status < 500) return "dropped";
  return "retry";
}

export type Outcome =
  | { clientId: string; result: "sent"; status: number; body?: unknown }
  | { clientId: string; result: "dropped"; status: number; body?: unknown }
  | { clientId: string; result: "retry"; status: number | null; retryAt: number };

export type FlushReport = { outcomes: Outcome[]; remaining: number; offline: boolean };
export type FlushOptions = { /** Ignore backoff, for example when the device comes back online. */ force?: boolean };

type Timer = ReturnType<typeof setTimeout>;

export type OutboxOptions = {
  storage: OutboxStorage;
  send: Sender;
  now?: () => number;
  isOnline?: () => boolean;
  /** Runs a flush exclusively, for example with Web Locks so two tabs do not send at once. */
  withLock?: <T>(run: () => Promise<T>) => Promise<T>;
  /** Told about items the server refused, so optimistic UI can roll back. */
  onDropped?: (item: OutboxItem, status: number, body: unknown) => void;
  setTimer?: (run: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
};

function toItem({ clientId, kind, url, body, createdAt }: QueuedItem): OutboxItem {
  return { clientId, kind, url, body, createdAt };
}

export class Outbox {
  private readonly storage: OutboxStorage;
  private readonly send: Sender;
  private readonly now: () => number;
  private readonly isOnline: () => boolean;
  private readonly withLock: <T>(run: () => Promise<T>) => Promise<T>;
  private readonly onDropped?: OutboxOptions["onDropped"];
  private readonly setTimer: (run: () => void, ms: number) => Timer;
  private readonly clearTimer: (timer: Timer) => void;

  private running: Promise<FlushReport> | null = null;
  private next: Promise<FlushReport> | null = null;
  private nextForce = false;
  private timer: Timer | null = null;
  private pending = 0;
  private readonly listeners = new Set<() => void>();

  constructor(options: OutboxOptions) {
    this.storage = options.storage;
    this.send = options.send;
    this.now = options.now ?? (() => Date.now());
    this.isOnline = options.isOnline ?? (() => true);
    this.withLock = options.withLock ?? ((run) => run());
    this.onDropped = options.onDropped;
    this.setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  }

  /** Items waiting to send, as of the last change this outbox saw. */
  get pendingCount(): number {
    return this.pending;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Re-reads the pending count from storage, for example after another tab changed it. */
  async refresh(): Promise<number> {
    const count = (await this.storage.list()).length;
    if (count !== this.pending) {
      this.pending = count;
      for (const listener of this.listeners) listener();
    }
    return count;
  }

  /** Stores the item for sending. Resolves false when an item with the same client id is already queued. */
  async enqueue(input: OutboxItem): Promise<boolean> {
    const item = outboxItemSchema.parse(input);
    const last = (await this.storage.list()).at(-1);
    const added = await this.storage.add({
      ...item,
      seq: Math.max(this.now(), (last?.seq ?? 0) + 1),
      attempts: 0,
      nextAttemptAt: 0,
    });
    await this.refresh();
    return added;
  }

  /**
   * Sends due items in order. Stops at the first item that must be retried, so later items never
   * overtake it. Calls made while a flush runs share one follow-up flush.
   */
  flush(options: FlushOptions = {}): Promise<FlushReport> {
    if (!this.running) {
      const run = this.withLock(() => this.run(options.force ?? false));
      this.running = run.finally(() => {
        this.running = null;
      });
      return this.running;
    }
    this.nextForce ||= options.force ?? false;
    if (!this.next) {
      this.next = this.running
        .catch(() => undefined)
        .then(() => {
          const force = this.nextForce;
          this.next = null;
          this.nextForce = false;
          return this.flush({ force });
        });
    }
    return this.next;
  }

  /** Stops the retry timer. Queued items stay stored for the next start. */
  dispose(): void {
    this.cancelTimer();
    this.listeners.clear();
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(at: number): void {
    this.cancelTimer();
    this.timer = this.setTimer(
      () => {
        this.timer = null;
        void this.flush();
      },
      Math.max(0, at - this.now()),
    );
  }

  private async run(force: boolean): Promise<FlushReport> {
    this.cancelTimer();
    const outcomes: Outcome[] = [];
    if (!this.isOnline()) {
      return { outcomes, remaining: await this.refresh(), offline: true };
    }

    for (const item of await this.storage.list()) {
      if (!force && item.nextAttemptAt > this.now()) {
        this.schedule(item.nextAttemptAt);
        break;
      }

      let response: SendResponse | null = null;
      try {
        response = await this.send(toItem(item));
      } catch {
        response = null;
      }

      const verdict = response ? classifyStatus(response.status) : "retry";
      if (verdict === "retry") {
        const attempts = item.attempts + 1;
        const retryAt = this.now() + backoffMs(attempts);
        await this.storage.update({ ...item, attempts, nextAttemptAt: retryAt });
        outcomes.push({ clientId: item.clientId, result: "retry", status: response?.status ?? null, retryAt });
        this.schedule(retryAt);
        break;
      }

      await this.storage.remove(item.clientId);
      const status = response?.status ?? 0;
      outcomes.push({ clientId: item.clientId, result: verdict, status, body: response?.body });
      if (verdict === "dropped") this.onDropped?.(toItem(item), status, response?.body);
    }

    return { outcomes, remaining: await this.refresh(), offline: false };
  }
}

/** POSTs the body as JSON. Redirects are not followed, so an expired session is retried, not lost. */
export const fetchSender: Sender = async (item) => {
  const response = await fetch(item.url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": item.clientId },
    credentials: "same-origin",
    redirect: "manual",
    body: JSON.stringify(item.body),
  });
  let body: unknown;
  if (response.headers.get("content-type")?.includes("application/json")) {
    body = await response.json().catch(() => undefined);
  }
  return { status: response.status, body };
};
