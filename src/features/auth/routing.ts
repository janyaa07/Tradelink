/**
 * Pure routing rules for the request proxy (ADR 0011, AUTH-03, AUTH-06, AUTH-10).
 * The proxy is a convenience only: RLS and database functions enforce every permission.
 */

export const ROLE_HOME = { buyer: "/buyer", supplier: "/supplier", platform: "/admin" } as const;
export type OrgKind = keyof typeof ROLE_HOME;

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const RESET_PASSWORD_PATH = "/reset-password";
export const EXPIRED_RESET_PATH = "/forgot-password?expired=1";
/** Where an expired or already-used sign-up confirmation link lands. */
export const EXPIRED_LINK_PATH = "/sign-in?link=expired";

/** Open to everyone, signed in or not. */
const PUBLIC_PATHS = ["/forgot-password", "/auth/callback", "/api/health"] as const;

/** For signed-out users only: a signed-in user is sent to their home. */
const SIGNED_OUT_PATHS = [SIGN_IN_PATH, SIGN_UP_PATH] as const;

function matches(pathname: string, paths: readonly string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isOrgKind(value: unknown): value is OrgKind {
  return typeof value === "string" && Object.hasOwn(ROLE_HOME, value);
}

/** The home page for an organisation kind, or null when the kind is unknown. */
export function homeFor(kind: string | null | undefined): string | null {
  return isOrgKind(kind) ? ROLE_HOME[kind] : null;
}

function roleOfPath(pathname: string): OrgKind | null {
  if (matches(pathname, ["/buyer"])) return "buyer";
  if (matches(pathname, ["/supplier"])) return "supplier";
  if (matches(pathname, ["/admin"])) return "platform";
  return null;
}

/** True when a signed-in user opens another role's area, which is logged as a denied attempt. */
export function isOtherRolePath(pathname: string, kind: string | null): boolean {
  const pathRole = roleOfPath(pathname);
  return pathRole !== null && pathRole !== kind;
}

/**
 * A same-site path to redirect to, or the fallback. Rejects absolute and protocol-relative
 * URLs ("//evil.test", "/\evil.test"), control characters, and anything that would leave this origin.
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) {
    return fallback;
  }
  try {
    const base = "http://tradelink.invalid";
    const url = new URL(value, base);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return url.origin === base && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}

export type RouteInput = {
  pathname: string;
  signedIn: boolean;
  /** `whoami().kind`, or null when the user has no organisation. */
  kind: string | null;
};

/** "allow", or the path to redirect to. */
export type RouteDecision = "allow" | (string & {});

function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}

export function decideRoute({ pathname, signedIn, kind }: RouteInput): RouteDecision {
  if (!signedIn) {
    if (matches(pathname, PUBLIC_PATHS) || matches(pathname, SIGNED_OUT_PATHS)) return "allow";
    if (matches(pathname, [RESET_PASSWORD_PATH])) return EXPIRED_RESET_PATH;
    return pathname === "/" ? SIGN_IN_PATH : withNext(SIGN_IN_PATH, pathname);
  }

  // Set a new password needs a session but no organisation, so a user can always finish a reset.
  if (matches(pathname, PUBLIC_PATHS) || matches(pathname, [RESET_PASSWORD_PATH])) return "allow";

  const home = homeFor(kind);
  if (!home) {
    // Signed in without an organisation: only Sign in is useful, and redirecting it to itself would loop.
    return pathname === SIGN_IN_PATH ? "allow" : SIGN_IN_PATH;
  }

  if (pathname === "/" || matches(pathname, SIGNED_OUT_PATHS)) return home;
  if (isOtherRolePath(pathname, kind)) return home;
  return "allow";
}
