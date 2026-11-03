import type { z } from "zod";

/** What a handler is told about the run. `signal` aborts when the per-job timeout passes. */
export type JobContext = {
  jobId: string;
  attempt: number;
  now: Date;
  signal: AbortSignal;
};

export type JobResult = { ok: true } | { ok: false; error: string };

export type JobHandler<S extends z.ZodType> = {
  schema: S;
  run: (ctx: JobContext, payload: z.infer<S>) => Promise<JobResult>;
};

/** A handler with its payload check applied, so the registry can hold every kind in one map. */
export type DefinedJob = {
  execute: (ctx: JobContext, payload: unknown) => Promise<JobResult>;
};

/** Wraps a handler so its payload is checked with its Zod schema before it runs. */
export function defineJob<S extends z.ZodType>(handler: JobHandler<S>): DefinedJob {
  return {
    execute: async (ctx, payload) => {
      const parsed = handler.schema.safeParse(payload);
      if (!parsed.success) return { ok: false, error: "invalid payload" };
      return handler.run(ctx, parsed.data);
    },
  };
}
