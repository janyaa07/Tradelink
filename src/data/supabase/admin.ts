import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { publicEnv } from "@/lib/env";

const secretSchema = z.string().min(20, "SUPABASE_SECRET_KEY is missing. Add it to .env.local (server only).");

let client: SupabaseClient | null = null;

/**
 * The server's own Supabase client, signed in with the secret key. It is the only way to write agent
 * output (cards, agent messages, the agent log) and to run jobs, so a signed-in user can never forge
 * them. Never import this from client code; `server-only` makes that a build error.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (client) return client;
  const secret = secretSchema.parse(process.env.SUPABASE_SECRET_KEY);
  client = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** True when the secret key is configured, so callers can report a clear setup error instead of crashing. */
export function hasAdminClient(): boolean {
  return secretSchema.safeParse(process.env.SUPABASE_SECRET_KEY).success;
}
