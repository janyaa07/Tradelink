import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRoute, isOtherRolePath } from "@/features/auth/routing";

/**
 * Refreshes the Supabase session, keeps signed-out users on Sign in, Create an account and the
 * password reset pages, and routes each role to its own area (ADR 0011, AUTH-06, AUTH-10).
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
  if (data.user) {
    const { data: who } = await supabase.rpc("whoami");
    kind = who && typeof who === "object" && "kind" in who ? String(who.kind) : null;
  }

  const decision = decideRoute({ pathname, signedIn: Boolean(data.user), kind });
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
