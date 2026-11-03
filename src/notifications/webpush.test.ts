import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class WebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return { sendNotification: vi.fn(), WebPushError };
});

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ sendNotification: mocks.sendNotification, WebPushError: mocks.WebPushError }));

const { isWebPushConfigured, sendWebPush } = await import("./webpush");

const SUB = { endpoint: "https://push.example.com/a", keys: { p256dh: "p".repeat(20), auth: "a".repeat(10) } };
const PAYLOAD = { title: "Support replied", body: "Open the chat.", url: "/r", notificationId: "n1", tag: "support_reply:n1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "B".repeat(40));
  vi.stubEnv("VAPID_PRIVATE_KEY", "k".repeat(40));
  vi.stubEnv("VAPID_SUBJECT", "mailto:ops@example.com");
  mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
});

afterEach(() => vi.unstubAllEnvs());

describe("sendWebPush", () => {
  it("sends the JSON payload with VAPID details, and high urgency with a short TTL when urgent", async () => {
    expect(await sendWebPush(SUB, PAYLOAD, { urgent: true })).toEqual({ ok: true });
    const [subscription, body, options] = mocks.sendNotification.mock.calls[0] ?? [];
    expect(subscription).toEqual(SUB);
    expect(JSON.parse(body)).toEqual(PAYLOAD);
    expect(options).toMatchObject({ urgency: "high", TTL: 3600, vapidDetails: { subject: "mailto:ops@example.com" } });

    await sendWebPush(SUB, PAYLOAD, { urgent: false });
    expect(mocks.sendNotification.mock.calls[1]?.[2]).toMatchObject({ urgency: "normal", TTL: 43200 });
  });

  it("reports 404 and 410 as gone, other failures as not gone, without the endpoint", async () => {
    mocks.sendNotification.mockRejectedValueOnce(new mocks.WebPushError("Received unexpected response code", 410));
    expect(await sendWebPush(SUB, PAYLOAD, { urgent: false })).toEqual({ ok: false, gone: true, error: "push service answered 410" });
    mocks.sendNotification.mockRejectedValueOnce(new mocks.WebPushError("Received unexpected response code", 429));
    expect(await sendWebPush(SUB, PAYLOAD, { urgent: false })).toEqual({ ok: false, gone: false, error: "push service answered 429" });
    mocks.sendNotification.mockRejectedValueOnce(new Error(`socket hang up ${SUB.endpoint}`));
    expect(await sendWebPush(SUB, PAYLOAD, { urgent: false })).toEqual({ ok: false, gone: false, error: "push request failed" });
  });

  it("does not send when the VAPID settings are missing", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(isWebPushConfigured()).toBe(false);
    expect(await sendWebPush(SUB, PAYLOAD, { urgent: false })).toEqual({ ok: false, gone: false, error: "web push is not configured" });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
