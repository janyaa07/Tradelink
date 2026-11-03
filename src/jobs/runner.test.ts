import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callSystemRpc: vi.fn(),
  runJob: vi.fn(),
  hasAdminClient: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("./system-rpc", () => ({
  callSystemRpc: mocks.callSystemRpc,
  errorText: (error: unknown) => (error instanceof Error ? error.message : "unknown error"),
}));
vi.mock("./registry", () => ({ runJob: mocks.runJob }));
vi.mock("@/data/supabase/admin", () => ({ hasAdminClient: mocks.hasAdminClient }));

const { runDueJobs } = await import("./runner");
const { handleJobsRun } = await import("./http");

const job = (n: number, kind = "system.ping") => ({
  id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
  kind,
  payload: { n },
  attempts: 1,
  status: "RUNNING",
});

/** Queues claim results in order; every other RPC (rs_job_finish) succeeds. */
function claims(...batches: unknown[][]) {
  const queue = [...batches];
  mocks.callSystemRpc.mockImplementation(async (name: string) =>
    name === "rs_job_claim" ? { ok: true, data: queue.shift() ?? [] } : { ok: true, data: null },
  );
}

const finishes = () => mocks.callSystemRpc.mock.calls.filter(([name]) => name === "rs_job_finish").map(([, args]) => args);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasAdminClient.mockReturnValue(true);
  mocks.runJob.mockResolvedValue({ ok: true });
});

describe("runDueJobs", () => {
  it("claims due jobs, runs each and finishes it ok", async () => {
    claims([job(1), job(2)]);
    expect(await runDueJobs()).toEqual({ claimed: 2, done: 2, failed: 0 });
    expect(mocks.runJob).toHaveBeenCalledWith("system.ping", expect.objectContaining({ jobId: job(1).id, attempt: 1 }), { n: 1 });
    expect(finishes()).toEqual([
      { p_id: job(1).id, p_ok: true, p_error: null },
      { p_id: job(2).id, p_ok: true, p_error: null },
    ]);
  });

  it("records a failed result, a thrown error and an unknown kind as failures without stopping", async () => {
    claims([job(1), job(2), job(3, "no.such")]);
    mocks.runJob
      .mockResolvedValueOnce({ ok: false, error: "supplier not found" })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: false, error: "unknown job kind" });
    expect(await runDueJobs()).toEqual({ claimed: 3, done: 0, failed: 3 });
    expect(finishes().map((args) => args.p_error)).toEqual(["supplier not found", "boom", "unknown job kind"]);
  });

  it("fails a job that runs past its timeout and aborts its signal", async () => {
    claims([job(1)]);
    let signal: AbortSignal | undefined;
    mocks.runJob.mockImplementation((_kind: string, ctx: { signal: AbortSignal }) => {
      signal = ctx.signal;
      return new Promise(() => undefined);
    });
    expect(await runDueJobs({ jobTimeoutMs: 20 })).toEqual({ claimed: 1, done: 0, failed: 1 });
    expect(finishes()).toEqual([{ p_id: job(1).id, p_ok: false, p_error: "timed out" }]);
    expect(signal?.aborted).toBe(true);
  });

  it("keeps claiming full batches up to the job limit", async () => {
    claims([job(1), job(2), job(3), job(4), job(5)], [job(6), job(7)]);
    expect(await runDueJobs({ maxJobs: 7, jobTimeoutMs: 1000 })).toEqual({ claimed: 7, done: 7, failed: 0 });
    const limits = mocks.callSystemRpc.mock.calls.filter(([name]) => name === "rs_job_claim").map(([, args]) => args.p_limit);
    expect(limits).toEqual([5, 2]);
  });

  it("claims only what the remaining budget can finish", async () => {
    claims([job(1)]);
    let now = 0;
    const clock = () => now;
    mocks.runJob.mockImplementation(async () => {
      now += 30_000;
      return { ok: true };
    });
    expect(await runDueJobs({ budgetMs: 50_000, jobTimeoutMs: 15_000, clock })).toEqual({ claimed: 1, done: 1, failed: 0 });
    const limits = mocks.callSystemRpc.mock.calls.filter(([name]) => name === "rs_job_claim").map(([, args]) => args.p_limit);
    expect(limits).toEqual([3]);
  });

  it("returns zero counts when claiming fails, and skips malformed rows", async () => {
    mocks.callSystemRpc.mockResolvedValueOnce({ ok: false, error: "Background jobs are not set up on this server.", reason: "NOT_CONFIGURED" });
    expect(await runDueJobs()).toEqual({ claimed: 0, done: 0, failed: 0 });

    claims([{ kind: "system.ping" }, job(1)]);
    expect(await runDueJobs()).toEqual({ claimed: 1, done: 1, failed: 0 });
  });
});

describe("handleJobsRun", () => {
  it("returns only the counts", async () => {
    claims([job(1)]);
    const response = await handleJobsRun();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, done: 1, failed: 0 });
  });

  it("refuses an overlapping run in the same instance", async () => {
    claims([job(1)]);
    let release: () => void = () => undefined;
    mocks.runJob.mockImplementation(() => new Promise((resolve) => (release = () => resolve({ ok: true }))));
    const first = handleJobsRun();
    await vi.waitFor(() => expect(mocks.runJob).toHaveBeenCalled());
    const second = await handleJobsRun();
    expect(second.status).toBe(202);
    expect(await second.json()).toEqual({ claimed: 0, done: 0, failed: 0, busy: true });
    release();
    expect((await first).status).toBe(200);
  });

  it("answers 503 when the secret key is missing", async () => {
    mocks.hasAdminClient.mockReturnValue(false);
    const response = await handleJobsRun();
    expect(response.status).toBe(503);
    expect(mocks.callSystemRpc).not.toHaveBeenCalled();
  });
});
