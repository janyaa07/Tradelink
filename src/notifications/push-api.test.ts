import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/data/rpc", () => ({ callRpc: mocks.callRpc }));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

const { handleOpened, handleSubscribe } = await import("./push-api");

const SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  expirationTime: null,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
};
const NOTIFICATION = "aaaaaaaa-0000-4000-8000-000000000001";

function post(body: unknown): Request {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.callRpc.mockResolvedValue({ ok: true, data: "device-1" });
});

describe("POST /api/push/subscribe", () => {
  it("registers a valid subscription as the signed-in person", async () => {
    const response = await handleSubscribe(post({ subscription: SUBSCRIPTION, appVersion: "0.5.0" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deviceId: "device-1", push: true });
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_device_register", {
      p_platform: "web",
      p_subscription: SUBSCRIPTION,
      p_app_version: "0.5.0",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/r", "layout");
  });

  it("turns push off with a null subscription", async () => {
    const response = await handleSubscribe(post({ subscription: null, appVersion: "0.5.0" }));
    expect(await response.json()).toMatchObject({ ok: true, push: false });
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_device_register", expect.objectContaining({ p_subscription: null }));
  });

  it.each([
    ["an http endpoint", { subscription: { ...SUBSCRIPTION, endpoint: "http://push.example.com/x" }, appVersion: "0.5.0" }],
    ["a missing auth key", { subscription: { ...SUBSCRIPTION, keys: { p256dh: SUBSCRIPTION.keys.p256dh } }, appVersion: "0.5.0" }],
    ["a key that is not base64url", { subscription: { ...SUBSCRIPTION, keys: { ...SUBSCRIPTION.keys, auth: "not base64 at all!" } }, appVersion: "0.5.0" }],
    ["a missing app version", { subscription: SUBSCRIPTION }],
    ["an app version over 40 characters", { subscription: SUBSCRIPTION, appVersion: "1".repeat(41) }],
    ["a body that is not JSON", "{nope"],
  ])("rejects %s with 400", async (_label, body) => {
    const response = await handleSubscribe(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Check the details and try again." });
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await handleSubscribe(post({ subscription: SUBSCRIPTION, appVersion: "0.5.0" }));
    expect(response.status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("maps a database refusal to its status and copy", async () => {
    mocks.callRpc.mockResolvedValue({ ok: false, error: "Check the details and try again.", reason: "INVALID_INPUT" });
    const response = await handleSubscribe(post({ subscription: SUBSCRIPTION, appVersion: "0.5.0" }));
    expect(response.status).toBe(400);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("POST /api/push/opened", () => {
  it("records the open", async () => {
    mocks.callRpc.mockResolvedValue({ ok: true, data: null });
    const response = await handleOpened(post({ notificationId: NOTIFICATION }));
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_notification_opened", { p_id: NOTIFICATION });
  });

  it("rejects an id that is not a uuid, and a signed-out caller", async () => {
    expect((await handleOpened(post({ notificationId: "push-1" }))).status).toBe(400);
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await handleOpened(post({ notificationId: NOTIFICATION }))).status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
});
