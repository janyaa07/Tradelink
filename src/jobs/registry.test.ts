import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logEvent: vi.fn(), callSystemRpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/events", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/jobs/system-rpc", () => ({ callSystemRpc: mocks.callSystemRpc }));
vi.mock("@/jobs/enqueue", () => ({ enqueueJob: vi.fn() }));
vi.mock("@/notifications/webpush", () => ({ sendWebPush: vi.fn() }));

const { runJob } = await import("./registry");

const ctx = () => ({ jobId: "job-1", attempt: 1, now: new Date(), signal: new AbortController().signal });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logEvent.mockResolvedValue({ ok: true, data: undefined });
});

describe("runJob", () => {
  it("fails an unknown kind without throwing", async () => {
    expect(await runJob("po.chase", ctx(), {})).toEqual({ ok: false, error: "unknown job kind" });
  });

  it("fails an invalid payload before the handler runs", async () => {
    expect(await runJob("notify.release", ctx(), { releaseAt: "tomorrow" })).toEqual({ ok: false, error: "invalid payload" });
    expect(mocks.callSystemRpc).not.toHaveBeenCalled();
  });

  it("runs system.ping, which records a system event", async () => {
    expect(await runJob("system.ping", ctx(), {})).toEqual({ ok: true });
    expect(mocks.logEvent).toHaveBeenCalledWith("system.ping", { as: "system", props: { jobId: "job-1", attempt: 1 } });
  });

  it("passes on a ping that could not be recorded", async () => {
    mocks.logEvent.mockResolvedValue({ ok: false, error: "Background jobs are not set up on this server." });
    expect(await runJob("system.ping", ctx(), {})).toEqual({ ok: false, error: "Background jobs are not set up on this server." });
  });

  it("runs notify.release when nothing is held", async () => {
    mocks.callSystemRpc.mockResolvedValue({ ok: true, data: [] });
    expect(await runJob("notify.release", ctx(), { releaseAt: "2026-11-04T22:00:00.000Z" })).toEqual({ ok: true });
    expect(mocks.callSystemRpc).toHaveBeenCalledWith("rs_notification_claim_held", { p_limit: 50 });
  });
});
