import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { EXPIRED_LINK_PATH, EXPIRED_RESET_PATH, RESET_PASSWORD_PATH, safeNextPath } from "@/features/auth/routing";
import { logger } from "@/lib/logger";

/**
 * Exchanges the PKCE code from an emailed link for a session, then continues to `next`: a password
 * reset link (AUTH-03) goes on to Set a new password, a sign-up confirmation link (AUTH-10) to the home.
 * In a Route Handler the server client can write the session cookies onto the response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/");
  const isReset = next === RESET_PASSWORD_PATH || next.startsWith(`${RESET_PASSWORD_PATH}?`);
  const expired = () => NextResponse.redirect(new URL(isReset ? EXPIRED_RESET_PATH : EXPIRED_LINK_PATH, request.url));

  if (!code) return expired();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn("auth.callback.exchange_failed", { errorCode: error.code ?? null, status: error.status ?? null });
    return expired();
  }
  return NextResponse.redirect(new URL(next, request.url));
}
