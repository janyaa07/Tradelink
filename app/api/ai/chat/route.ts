import { z } from "zod";
import { getSession, roleOf } from "@/data/session";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { runAgent, type AiStreamEvent } from "@/features/ai/agent";
import { isClaudeConfigured } from "@/integrations/claude/client";

export const maxDuration = 60;

const MAX_CHARS = 2000;
const LIMIT_PER_HOUR = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHARS),
  history: z.array(z.object({ role: z.enum(["buyer", "tradelink"]), text: z.string().max(MAX_CHARS) })).max(20),
});

function line(event: AiStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function single(event: AiStreamEvent, status = 200): Response {
  const body = [event, { type: "done" }].map((entry) => `${JSON.stringify(entry)}\n`).join("");
  return new Response(body, { status, headers: { "content-type": "application/x-ndjson" } });
}

/** Tradelink AI chat: streams NDJSON events (text, status, cards, proposals) for one message. */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  const role = session ? roleOf(session.kind) : null;
  if (!session || (role !== "buyer" && role !== "supplier")) return single({ type: "error", message: "Sign in again to use Tradelink AI." }, 401);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return single({ type: "error", message: "Type a message of up to 2,000 characters." }, 400);
  if (!isClaudeConfigured()) return single({ type: "error", message: "Tradelink AI is not set up yet." }, 503);

  const supabase = await createSupabaseServerClient();
  const { data: allowed } = await supabase.rpc("hit_rate_limit", { p_action: "ask", p_limit: LIMIT_PER_HOUR, p_window_seconds: 3600 });
  if (allowed === false) return single({ type: "error", message: "That is a lot of questions for one hour. Try again in a few minutes." }, 429);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AiStreamEvent) => controller.enqueue(line(event));
      await runAgent({ session, role, now: new Date() }, body.data.history, body.data.message, emit);
      emit({ type: "done" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
