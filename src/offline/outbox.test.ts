import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backoffMs,
  classifyStatus,
  MAX_BACKOFF_MS,
  MemoryOutboxStorage,
  Outbox,
  type OutboxItem,
  type OutboxOptions,
  type SendResponse,
} from "./outbox";

const START = Date.parse("2026-11-03T09:00:00+08:00");

let counter = 0;
function item(overrides: Partial<OutboxItem> = {}): OutboxItem {
  counter++;
  return {
    clientId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    kind: "chat_message",
    url: "/api/cards/message",
    body: { text: `message ${counter}` },
    createdAt: new Date(Date.now()).toISOString(),
    ...overrides,
  };
}

type Script = Array<number | "network">;

/** A sender that answers each client id from its script, defaulting to 200, and records every call. */
function scriptedSender(scripts: Record<string, Script> = {}) {
  const calls: string[] = [];
  const send = vi.fn(async (sent: OutboxItem): Promise<SendResponse> => {
    calls.push(sent.clientId);
    const next = scripts[sent.clientId]?.shift() ?? 200;
    if (next === "network") throw new TypeError("Failed to fetch");
    return { status: next, body: { ok: next < 300 } };
  });
  return { send, calls };
}

function makeOutbox(options: Partial<OutboxOptions> & Pick<OutboxOptions, "send">) {
  const storage = options.storage ?? new MemoryOutboxStorage();
  return { outbox: new Outbox({ ...options, storage }), storage };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("backoffMs", () => {
  it("doubles from one second", () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it("caps at five minutes", () => {
    expect(backoffMs(9)).toBe(256_000);
    expect(backoffMs(10)).toBe(MAX_BACKOFF_MS);
    expect(backoffMs(60)).toBe(MAX_BACKOFF_MS);
  });

  it("treats zero attempts as the first", () => {
    expect(backoffMs(0)).toBe(1000);
  });
});

describe("classifyStatus", () => {
  it.each([200, 201, 204, 299])("treats %i as sent", (status) => expect(classifyStatus(status)).toBe("sent"));
  it.each([400, 401, 403, 404, 409, 410, 422])("drops %i", (status) => expect(classifyStatus(status)).toBe("dropped"));
  it.each([408, 429, 500, 502, 503, 0, 302])("retries %i", (status) => expect(classifyStatus(status)).toBe("retry"));
});

describe("enqueue", () => {
  it("stores items and counts them", async () => {
    const { outbox } = makeOutbox({ send: scriptedSender().send });
    const listener = vi.fn();
    outbox.subscribe(listener);
    expect(await outbox.enqueue(item())).toBe(true);
    expect(await outbox.enqueue(item())).toBe(true);
    expect(outbox.pendingCount).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("refuses a second item with the same client id", async () => {
    const { send, calls } = scriptedSender();
    const { outbox, storage } = makeOutbox({ send });
    const first = item();
    expect(await outbox.enqueue(first)).toBe(true);
    expect(await outbox.enqueue({ ...first, body: { text: "changed" } })).toBe(false);
    expect(await storage.list()).toHaveLength(1);
    expect((await storage.list())[0]?.body).toEqual(first.body);

    await outbox.flush();
    expect(calls).toEqual([first.clientId]);
  });

  it("keeps order even when the clock goes backwards", async () => {
    const { send, calls } = scriptedSender();
    const { outbox } = makeOutbox({ send });
    const a = item();
    await outbox.enqueue(a);
    vi.setSystemTime(START - 60_000);
    const b = item();
    await outbox.enqueue(b);
    await outbox.flush();
    expect(calls).toEqual([a.clientId, b.clientId]);
  });

  it.each([
    ["another site", { url: "https://evil.test/api" }],
    ["a protocol-relative url", { url: "//evil.test/api" }],
    ["a backslash path", { url: "/\\evil.test" }],
    ["a client id that is not a uuid", { clientId: "abc" }],
    ["an unknown kind", { kind: "payment" as OutboxItem["kind"] }],
    ["a bad timestamp", { createdAt: "yesterday" }],
  ])("rejects %s", async (_label, overrides) => {
    const { outbox } = makeOutbox({ send: scriptedSender().send });
    await expect(outbox.enqueue(item(overrides))).rejects.toThrow();
    expect(outbox.pendingCount).toBe(0);
  });
});

describe("flush", () => {
  it("sends items in the order they were queued and removes them on 2xx", async () => {
    const { send, calls } = scriptedSender();
    const { outbox, storage } = makeOutbox({ send });
    const items = [item(), item({ kind: "card_action", url: "/api/cards/tap" }), item({ kind: "event" })];
    for (const entry of items) await outbox.enqueue(entry);

    const report = await outbox.flush();
    expect(calls).toEqual(items.map((entry) => entry.clientId));
    expect(report.outcomes.map((outcome) => outcome.result)).toEqual(["sent", "sent", "sent"]);
    expect(report.remaining).toBe(0);
    expect(await storage.list()).toEqual([]);
  });

  it("posts exactly the stored item", async () => {
    const { send } = scriptedSender();
    const { outbox } = makeOutbox({ send });
    const entry = item({ kind: "card_fields", url: "/api/cards/fields", body: { cardId: "c1", version: 2, fields: { qty: 3 } } });
    await outbox.enqueue(entry);
    await outbox.flush();
    expect(send).toHaveBeenCalledWith(entry);
  });

  it("returns the response body of a sent item", async () => {
    const { send } = scriptedSender();
    const { outbox } = makeOutbox({ send });
    const entry = item();
    await outbox.enqueue(entry);
    const report = await outbox.flush();
    expect(report.outcomes[0]).toEqual({ clientId: entry.clientId, result: "sent", status: 200, body: { ok: true } });
  });

  it.each([400, 403, 404, 409, 422])("drops an item refused with %i and carries on", async (status) => {
    const refused = item();
    const after = item();
    const { send, calls } = scriptedSender({ [refused.clientId]: [status] });
    const onDropped = vi.fn();
    const { outbox, storage } = makeOutbox({ send, onDropped });
    await outbox.enqueue(refused);
    await outbox.enqueue(after);

    const report = await outbox.flush();
    expect(calls).toEqual([refused.clientId, after.clientId]);
    expect(report.outcomes.map((outcome) => outcome.result)).toEqual(["dropped", "sent"]);
    expect(onDropped).toHaveBeenCalledWith(refused, status, { ok: false });
    expect(await storage.list()).toEqual([]);
  });

  it("drops a stale card tap (409) without ever sending it again", async () => {
    const stale = item({ kind: "card_action", url: "/api/cards/tap", body: { cardId: "c1", version: 1 } });
    const { send, calls } = scriptedSender({ [stale.clientId]: [409] });
    const { outbox } = makeOutbox({ send });
    await outbox.enqueue(stale);
    await outbox.flush();
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS * 2);
    await outbox.flush({ force: true });
    expect(calls).toEqual([stale.clientId]);
  });

  it.each([408, 429, 500, 503, "network"] as const)("keeps an item that failed with %s and stops there", async (failure) => {
    const failing = item();
    const later = item();
    const { send, calls } = scriptedSender({ [failing.clientId]: [failure] });
    const { outbox, storage } = makeOutbox({ send });
    await outbox.enqueue(failing);
    await outbox.enqueue(later);

    const report = await outbox.flush();
    expect(calls).toEqual([failing.clientId]);
    expect(report.outcomes).toEqual([
      { clientId: failing.clientId, result: "retry", status: failure === "network" ? null : failure, retryAt: START + 1000 },
    ]);
    expect(report.remaining).toBe(2);
    const [head] = await storage.list();
    expect(head).toMatchObject({ clientId: failing.clientId, attempts: 1, nextAttemptAt: START + 1000 });
  });

  it("retries on its own with exponential backoff, then sends the rest in order", async () => {
    const failing = item();
    const later = item();
    const { send, calls } = scriptedSender({ [failing.clientId]: [503, "network", 429] });
    const { outbox } = makeOutbox({ send });
    await outbox.enqueue(failing);
    await outbox.enqueue(later);

    await outbox.flush();
    expect(calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(4000);
    expect(calls).toEqual([failing.clientId, failing.clientId, failing.clientId, failing.clientId, later.clientId]);
    expect(outbox.pendingCount).toBe(0);
  });

  it("never waits more than five minutes between tries", async () => {
    const failing = item();
    const { send, calls } = scriptedSender({ [failing.clientId]: Array<number>(12).fill(503) });
    const { outbox, storage } = makeOutbox({ send });
    await outbox.enqueue(failing);
    await outbox.flush();
    // Tries at 0, 1, 3, 7, 15, 31, 63, 127 and 255 seconds, then every 300: the 12th is at 1111 seconds.
    await vi.advanceTimersByTimeAsync(1_110_999);
    expect(calls).toHaveLength(11);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(12);
    const [head] = await storage.list();
    expect(head?.attempts).toBe(12);
    expect(head && head.nextAttemptAt - Date.now()).toBe(MAX_BACKOFF_MS);
  });

  it("does not send an item before its retry time", async () => {
    const failing = item();
    const { send, calls } = scriptedSender({ [failing.clientId]: [500] });
    const { outbox } = makeOutbox({ send });
    await outbox.enqueue(failing);
    await outbox.flush();
    const report = await outbox.flush();
    expect(calls).toHaveLength(1);
    expect(report.outcomes).toEqual([]);
  });

  it("ignores backoff when forced, as on reconnecting", async () => {
    const failing = item();
    const { send, calls } = scriptedSender({ [failing.clientId]: ["network"] });
    const { outbox } = makeOutbox({ send });
    await outbox.enqueue(failing);
    await outbox.flush();
    await outbox.flush({ force: true });
    expect(calls).toEqual([failing.clientId, failing.clientId]);
    expect(outbox.pendingCount).toBe(0);
  });

  it("sends nothing and counts no attempt while offline", async () => {
    let online = false;
    const { send } = scriptedSender();
    const { outbox, storage } = makeOutbox({ send, isOnline: () => online });
    await outbox.enqueue(item());

    const report = await outbox.flush();
    expect(report).toEqual({ outcomes: [], remaining: 1, offline: true });
    expect(send).not.toHaveBeenCalled();
    expect((await storage.list())[0]?.attempts).toBe(0);

    online = true;
    await outbox.flush({ force: true });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends each item once when flushes overlap", async () => {
    const { send, calls } = scriptedSender();
    const { outbox } = makeOutbox({ send });
    const items = [item(), item(), item()];
    for (const entry of items) await outbox.enqueue(entry);

    await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);
    expect(calls).toEqual(items.map((entry) => entry.clientId));
  });

  it("sends an item queued during a flush in the follow-up flush", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = item();
    const second = item();
    const calls: string[] = [];
    const send = vi.fn(async (sent: OutboxItem) => {
      calls.push(sent.clientId);
      if (sent.clientId === first.clientId) await gate;
      return { status: 200 };
    });
    const { outbox } = makeOutbox({ send });
    await outbox.enqueue(first);
    const running = outbox.flush();
    await vi.advanceTimersByTimeAsync(0);
    await outbox.enqueue(second);
    const followUp = outbox.flush();
    release();
    const report = await followUp;
    await running;
    expect(calls).toEqual([first.clientId, second.clientId]);
    expect(report.outcomes.map((outcome) => outcome.clientId)).toEqual([second.clientId]);
  });

  it("runs each flush inside the lock", async () => {
    let locked = 0;
    const withLock = <T,>(run: () => Promise<T>) => {
      locked++;
      return run();
    };
    const { outbox } = makeOutbox({ send: scriptedSender().send, withLock });
    await outbox.enqueue(item());
    await outbox.flush();
    expect(locked).toBe(1);
  });

  it("keeps a failed item stored across a restart", async () => {
    const storage = new MemoryOutboxStorage();
    const failing = item();
    const first = makeOutbox({ storage, send: scriptedSender({ [failing.clientId]: ["network"] }).send });
    await first.outbox.enqueue(failing);
    await first.outbox.flush();
    first.outbox.dispose();

    const { send, calls } = scriptedSender();
    const second = makeOutbox({ storage, send });
    expect(await second.outbox.refresh()).toBe(1);
    await second.outbox.flush({ force: true });
    expect(calls).toEqual([failing.clientId]);
  });

  it("stops retrying after dispose", async () => {
    const failing = item();
    const { send, calls } = scriptedSender({ [failing.clientId]: [500] });
    const { outbox } = makeOutbox({ send });
    await outbox.enqueue(failing);
    await outbox.flush();
    outbox.dispose();
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);
    expect(calls).toHaveLength(1);
  });
});
