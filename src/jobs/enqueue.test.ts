import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  hasAdminClient: vi.fn(() => true),
  callRpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/data/supabase/admin", () => ({
  hasAdminClient: mocks.hasAdminClient,
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/data/rpc", () => ({ callRpc: mocks.callRpc }));

const { cancelJob, enqueueJob } = await import("./enqueue");
const { logEvent } = await import("@/lib/events");

const RUN_AT = new Date("2026-11-04T06:00:00+08:00");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasAdminClient.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({ data: "job-1", error: null });
  mocks.callRpc.mockResolvedValue({ ok: true, data: null });
});

describe("enqueueJob and cancelJob", () => {
  it("schedules through rs_job_enqueue with the secret-key client", async () => {
    expect(await enqueueJob("system.ping", RUN_AT, "ping:2026-11-04", { n: 1 })).toEqual({ ok: true, data: { id: "job-1" } });
    expect(mocks.rpc).toHaveBeenCalledWith("rs_job_enqueue", {
      p_kind: "system.ping",
      p_run_at: RUN_AT.toISOString(),
      p_dedupe_key: "ping:2026-11-04",
      p_payload: { n: 1 },
    });
    expect(await cancelJob("ping:2026-11-04")).toEqual({ ok: true, data: undefined });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rs_job_cancel", { p_dedupe_key: "ping:2026-11-04" });
  });

  it("rejects a bad time or dedupe key without calling the database", async () => {
    expect(await enqueueJob("system.ping", new Date("nope"), "k")).toMatchObject({ ok: false, reason: "INVALID_INPUT" });
    expect(await enqueueJob("system.ping", RUN_AT, " ")).toMatchObject({ ok: false });
    expect(await cancelJob("x".repeat(201))).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a typed database error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "TL403:FORBIDDEN:only the server can do this", code: "P0001" } });
    expect(await enqueueJob("system.ping", RUN_AT, "k")).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });

  it("fails clearly when the secret key is missing", async () => {
    mocks.hasAdminClient.mockReturnValue(false);
    expect(await enqueueJob("system.ping", RUN_AT, "k")).toEqual({
      ok: false,
      error: "Background jobs are not set up on this server.",
      reason: "NOT_CONFIGURED",
    });
  });
});

describe("logEvent", () => {
  const SHOP = "aaaaaaaa-0000-4000-8000-000000000002";

  it("logs as the signed-in person by default", async () => {
    const at = new Date("2026-11-03T10:00:00Z");
    expect(await logEvent("card.tapped", { shopId: SHOP, props: { card: "order_summary" }, clientEventId: "c1", occurredAt: at })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(mocks.callRpc).toHaveBeenCalledWith("rs_log_event", {
      p_name: "card.tapped",
      p_shop: SHOP,
      p_props: { card: "order_summary" },
      p_client_event_id: "c1",
      p_occurred_at: at.toISOString(),
    });
  });

  it("logs system events with the secret-key client", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await logEvent("system.ping", { as: "system" })).toEqual({ ok: true, data: undefined });
    expect(mocks.rpc).toHaveBeenCalledWith("rs_log_event", expect.objectContaining({ p_name: "system.ping", p_shop: null }));
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });

  it("rejects bad names and oversized props", async () => {
    expect(await logEvent("Card Tapped")).toMatchObject({ ok: false, reason: "INVALID_INPUT" });
    expect(await logEvent("x")).toMatchObject({ ok: false });
    expect(await logEvent("card.tapped", { props: { blob: "x".repeat(5000) } })).toMatchObject({ ok: false });
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
});
