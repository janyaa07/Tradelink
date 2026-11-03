import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/api/health"];
const ROLE_HOME = { buyer: "/buyer", supplier: "/supplier", platform: "/admin" } as const;
type OrgKind = keyof typeof ROLE_HOME;

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function roleOfPath(pathname: string): OrgKind | null {
  if (pathname.startsWith("/buyer")) return "buyer";
  if (pathname.startsWith("/supplier")) return "supplier";
  if (pathname.startsWith("/admin")) return "platform";
  return null;
}

/**
 * Refreshes the Supabase session and routes each role to its own area (ADR 0011).
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

  if (!data.user) {
    if (isPublic(pathname)) return response;
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return redirectTo(`/sign-in${next}`);
  }

  const { data: who } = await supabase.rpc("whoami");
  const kind = who && typeof who === "object" && "kind" in who ? String(who.kind) : null;
  const home = kind && kind in ROLE_HOME ? ROLE_HOME[kind as OrgKind] : "/sign-in";
  if (pathname === "/" || pathname === "/sign-in") return redirectTo(home);

  const pathRole = roleOfPath(pathname);
  if (pathRole && pathRole !== kind) {
    await supabase.rpc("log_denied", { p_action: `Blocked from opening ${pathname}` });
    return redirectTo(home);
  }

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|logo-green.svg|logo-white.svg|favicon.ico).*)"],
};
