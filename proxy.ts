import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRoute, isOtherRolePath } from "@/features/auth/routing";

/**
 * Refreshes the Supabase session, routes each role to its own area and holds platform users at
 * two-factor setup or verification until their session reaches aal2 (ADR 0011, AUTH-04).
 * This is a convenience only: RLS and database functions enforce every permission.
 */
export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  let kind: string | null = null;
  let currentLevel: string | null = null;
  let nextLevel: string | null = null;
  if (data.user) {
    const { data: who } = await supabase.rpc("whoami");
    kind = who && typeof who === "object" && "kind" in who ? String(who.kind) : null;
    if (kind === "platform") {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      currentLevel = aal?.currentLevel ?? null;
      nextLevel = aal?.nextLevel ?? null;
    }
  }

  const decision = decideRoute({ pathname, signedIn: Boolean(data.user), kind, currentLevel, nextLevel });
  if (decision !== "allow") {
    if (data.user && kind && isOtherRolePath(pathname, kind)) {
      await supabase.rpc("log_denied", { p_action: `Blocked from opening ${pathname}` });
    }
    return redirectTo(decision);
  }

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|logo-green.svg|logo-white.svg|favicon.ico).*)"],
};
