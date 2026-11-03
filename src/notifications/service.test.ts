import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callSystemRpc: vi.fn(),
  sendWebPush: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/jobs/system-rpc", () => ({ callSystemRpc: mocks.callSystemRpc }));
vi.mock("@/jobs/enqueue", () => ({ enqueueJob: mocks.enqueueJob }));
vi.mock("./webpush", () => ({ sendWebPush: mocks.sendWebPush }));

const { notify } = await import("./service");
const { notifyReleaseJob } = await import("./release");

const USER = "aaaaaaaa-0000-4000-8000-000000000001";
const SHOP = "aaaaaaaa-0000-4000-8000-000000000002";
const CARD = "aaaaaaaa-0000-4000-8000-000000000003";
const SUB_A = { endpoint: "https://push.example.com/a", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
const SUB_B = { ...SUB_A, endpoint: "https://push.example.com/b" };

const AFTERNOON = new Date("2026-11-03T14:00:00+08:00");
const NIGHT = new Date("2026-11-03T23:30:00+08:00");
const MORNING = new Date("2026-11-04T06:00:00+08:00");

type Context = Record<string, unknown>;
let context: Context;
let alert: { id: string; merged: boolean };
let held: unknown[];

function baseContext(): Context {
  return {
    daily_limit: 2,
    unprompted_today: 0,
    muted_types: [],
    push_off_types: [],
    ignored_streak: 0,
    same_item_today: false,
    quiet_start: "22:00",
    quiet_end: "06:00",
    devices: [SUB_A],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  context = baseContext();
  alert = { id: "alert-1", merged: false };
  held = [];
  let puts = 0;
  mocks.callSystemRpc.mockImplementation(async (name: string) => {
    switch (name) {
      case "rs_notification_put":
        puts += 1;
        return { ok: true, data: puts === 1 ? "in-app-1" : "push-1" };
      case "rs_alert_put":
        return { ok: true, data: alert };
      case "rs_notify_context":
        return { ok: true, data: context };
      case "rs_notification_claim_held": {
        const rows = held;
        held = [];
        return { ok: true, data: rows };
      }
      default:
        return { ok: true, data: null };
    }
  });
  mocks.sendWebPush.mockResolvedValue({ ok: true });
  mocks.enqueueJob.mockResolvedValue({ ok: true, data: { id: "job-1" } });
});

const calls = (name: string) => mocks.callSystemRpc.mock.calls.filter(([called]) => called === name).map(([, args]) => args);

const message = {
  userId: USER,
  shopId: SHOP,
  type: "arrival_check",
  promptKind: "unprompted" as const,
  cardId: CARD,
  title: "Did your delivery from Ah Seng arrive?",
  body: "Tell us if everything arrived, something is wrong, or it is not here yet.",
  itemKey: "po:123",
};

describe("notify", () => {
  it("writes the in-app row and an alert, then pushes now with the service worker payload", async () => {
    const result = await notify(message, AFTERNOON);
    expect(result).toEqual({
      ok: true,
      data: { notificationId: "in-app-1", pushId: "push-1", alertId: "alert-1", push: "now", reason: "within_limit", status: "SENT" },
    });
    const [inApp, push] = calls("rs_notification_put");
    expect(inApp?.p_notification).toMatchObject({ channel: "in_app", status: "SENT", user_id: USER, url: "/r", item_key: "po:123" });
    expect(push?.p_notification).toMatchObject({ channel: "push", status: "PENDING", alert_id: "alert-1" });
    expect(calls("rs_alert_put")[0]?.p_alert).toEqual({ shop_id: SHOP, type: "arrival_check", priority: "normal", item_key: "po:123", card_id: CARD });
    expect(mocks.sendWebPush).toHaveBeenCalledWith(
      SUB_A,
      { title: message.title, body: message.body, url: "/r", notificationId: "push-1", tag: "arrival_check:po:123" },
      { urgent: false },
    );
    expect(calls("rs_notification_update")).toEqual([{ p_id: "push-1", p_status: "SENT", p_error: null, p_release_at: null }]);
    expect(calls("rs_alert_update")).toEqual([{ p_id: "alert-1", p_status: "SENT", p_release_at: null }]);
  });

  it("holds an unprompted push in quiet hours and schedules notify.release at their end", async () => {
    const result = await notify(message, NIGHT);
    expect(result).toMatchObject({ ok: true, data: { push: "hold", status: "HELD" } });
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
    expect(calls("rs_notification_update")).toEqual([
      { p_id: "push-1", p_status: "HELD", p_error: null, p_release_at: MORNING.toISOString() },
    ]);
    expect(mocks.enqueueJob).toHaveBeenCalledWith("notify.release", MORNING, `notify.release:${MORNING.toISOString()}`, {
      releaseAt: MORNING.toISOString(),
    });
  });

  it("sends urgent messages at night with high urgency and no alert merge", async () => {
    const result = await notify({ ...message, type: "delivery_problem", promptKind: "urgent" }, NIGHT);
    expect(result).toMatchObject({ ok: true, data: { push: "now", reason: "urgent", status: "SENT" } });
    expect(calls("rs_alert_put")[0]?.p_alert).toMatchObject({ priority: "urgent" });
    expect(mocks.sendWebPush).toHaveBeenCalledWith(SUB_A, expect.anything(), { urgent: true });
  });

  it("keeps the alert queued with no push over the daily limit", async () => {
    context.unprompted_today = 2;
    const result = await notify(message, AFTERNOON);
    expect(result).toMatchObject({ ok: true, data: { push: "skip", reason: "daily_limit", status: "SKIPPED" } });
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
    expect(calls("rs_notification_update")).toEqual([{ p_id: "push-1", p_status: "SKIPPED", p_error: "daily_limit", p_release_at: null }]);
    expect(calls("rs_alert_update")).toEqual([]);
  });

  it("mutes a type after it was ignored 3 times in a row", async () => {
    context.ignored_streak = 3;
    const result = await notify(message, AFTERNOON);
    expect(result).toMatchObject({ ok: true, data: { push: "skip", reason: "ignored" } });
    expect(calls("rs_notify_mute")).toEqual([{ p_user: USER, p_type: "arrival_check" }]);
    expect(calls("rs_alert_update")).toEqual([{ p_id: "alert-1", p_status: "MUTED", p_release_at: null }]);
  });

  it("does not push a second message about the same item today", async () => {
    context.same_item_today = true;
    alert = { id: "alert-0", merged: true };
    const result = await notify(message, AFTERNOON);
    expect(result).toMatchObject({ ok: true, data: { alertId: "alert-0", push: "skip", reason: "merged" } });
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
  });

  it("writes no alert for a prompted reply and sends it at night", async () => {
    const result = await notify({ ...message, type: "order_summary", promptKind: "prompted", url: "/r/orders/1" }, NIGHT);
    expect(result).toMatchObject({ ok: true, data: { alertId: null, push: "now", reason: "prompted" } });
    expect(calls("rs_alert_put")).toEqual([]);
    expect(mocks.sendWebPush).toHaveBeenCalledWith(SUB_A, expect.objectContaining({ url: "/r/orders/1" }), { urgent: false });
  });

  it("marks a subscription gone on 410 and records FAILED when no device took the push", async () => {
    context.devices = [SUB_A, SUB_B, { endpoint: "http://insecure.example.com", keys: SUB_A.keys }];
    mocks.sendWebPush
      .mockResolvedValueOnce({ ok: false, gone: true, error: "push service answered 410" })
      .mockResolvedValueOnce({ ok: false, gone: false, error: "push service answered 500" });
    const result = await notify(message, AFTERNOON);
    expect(result).toMatchObject({ ok: true, data: { push: "now", status: "FAILED" } });
    expect(mocks.sendWebPush).toHaveBeenCalledTimes(2);
    expect(calls("rs_device_push_gone")).toEqual([{ p_endpoint: SUB_A.endpoint }]);
    expect(calls("rs_notification_update")[0]).toMatchObject({ p_status: "FAILED" });
    expect(calls("rs_notification_update")[0]?.p_error).toContain("410");
    expect(calls("rs_alert_update")).toEqual([]);
  });

  it("records SENT when one of several devices took the push", async () => {
    context.devices = [SUB_A, SUB_B];
    mocks.sendWebPush.mockResolvedValueOnce({ ok: false, gone: true, error: "push service answered 404" });
    expect(await notify(message, AFTERNOON)).toMatchObject({ ok: true, data: { status: "SENT" } });
  });

  it("skips the push with no device but keeps the in-app row", async () => {
    context.devices = [];
    expect(await notify(message, AFTERNOON)).toMatchObject({ ok: true, data: { notificationId: "in-app-1", push: "skip", reason: "no_device" } });
  });

  it("rejects invalid input without writing anything", async () => {
    expect(await notify({ ...message, url: "https://evil.example.com" })).toMatchObject({ ok: false, reason: "INVALID_INPUT" });
    expect(await notify({ ...message, url: "//evil.example.com" })).toMatchObject({ ok: false });
    expect(await notify({ ...message, title: "x".repeat(66) })).toMatchObject({ ok: false });
    expect(await notify({ ...message, type: "Bad Type" })).toMatchObject({ ok: false });
    expect(mocks.callSystemRpc).not.toHaveBeenCalled();
  });

  it("returns the database error when the in-app row cannot be written", async () => {
    mocks.callSystemRpc.mockResolvedValueOnce({ ok: false, error: "Background jobs are not set up on this server.", reason: "NOT_CONFIGURED" });
    expect(await notify(message, AFTERNOON)).toEqual({ ok: false, error: "Background jobs are not set up on this server.", reason: "NOT_CONFIGURED" });
  });

  it("still succeeds with the in-app row when the push context cannot be loaded", async () => {
    context = { broken: true };
    expect(await notify(message, AFTERNOON)).toMatchObject({ ok: true, data: { notificationId: "in-app-1", pushId: null, reason: "unavailable" } });
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
  });
});

describe("notify.release", () => {
  const ctx = () => ({ jobId: "job-1", attempt: 1, now: MORNING, signal: new AbortController().signal });
  const heldRow = (overrides: Record<string, unknown> = {}) => ({
    id: "push-9",
    user_id: USER,
    shop_id: SHOP,
    type: "arrival_check",
    prompt_kind: "unprompted",
    title: message.title,
    body: message.body,
    url: "/r",
    item_key: "po:123",
    alert_id: "alert-1",
    card_id: CARD,
    card_state: "open",
    opened_at: null,
    ...overrides,
  });

  it("sends a held push once quiet hours are over", async () => {
    held = [heldRow()];
    expect(await notifyReleaseJob.execute(ctx(), { releaseAt: MORNING.toISOString() })).toEqual({ ok: true });
    expect(mocks.sendWebPush).toHaveBeenCalledWith(SUB_A, expect.objectContaining({ notificationId: "push-9" }), { urgent: false });
    expect(calls("rs_notification_update")).toEqual([{ p_id: "push-9", p_status: "SENT", p_error: null, p_release_at: null }]);
  });

  it("re-checks the subject: skips a push that was opened or whose card was acted on", async () => {
    held = [heldRow({ id: "push-1", opened_at: "2026-11-03T23:40:00Z" }), heldRow({ id: "push-2", card_state: "done" })];
    expect(await notifyReleaseJob.execute(ctx(), {})).toEqual({ ok: true });
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
    expect(calls("rs_notification_update")).toEqual([
      { p_id: "push-1", p_status: "SKIPPED", p_error: "opened" },
      { p_id: "push-2", p_status: "SKIPPED", p_error: "card_closed" },
    ]);
  });

  it("re-applies the daily limit at release time", async () => {
    held = [heldRow()];
    context.unprompted_today = 2;
    expect(await notifyReleaseJob.execute(ctx(), {})).toEqual({ ok: true });
    expect(mocks.sendWebPush).not.toHaveBeenCalled();
    expect(calls("rs_notification_update")).toEqual([{ p_id: "push-9", p_status: "SKIPPED", p_error: "daily_limit", p_release_at: null }]);
  });

  it("fails so the runner retries when held pushes cannot be claimed", async () => {
    mocks.callSystemRpc.mockResolvedValueOnce({ ok: false, error: "x", reason: "NOT_CONFIGURED" });
    expect(await notifyReleaseJob.execute(ctx(), {})).toEqual({ ok: false, error: "NOT_CONFIGURED" });
  });
});
