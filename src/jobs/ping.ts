import "server-only";
import { z } from "zod";
import { logEvent } from "@/lib/events";
import { defineJob } from "./define";

/** A heartbeat: records a system.ping event so ops can see the runner is alive. */
export const systemPingJob = defineJob({
  schema: z.object({}).loose(),
  run: async (ctx) => {
    const logged = await logEvent("system.ping", { as: "system", props: { jobId: ctx.jobId, attempt: ctx.attempt } });
    return logged.ok ? { ok: true } : { ok: false, error: logged.error };
  },
});
