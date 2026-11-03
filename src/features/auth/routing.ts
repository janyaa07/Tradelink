/**
 * Pure routing rules for the request proxy (ADR 0011, AUTH-03, AUTH-04, AUTH-06).
 * The proxy is a convenience only: RLS and database functions enforce every permission.
 */

export const ROLE_HOME = { buyer: "/buyer", supplier: "/supplier", platform: "/admin" } as const;
export type OrgKind = keyof typeof ROLE_HOME;

/** Open to everyone, signed in or not. */
const PUBLIC_PATHS = ["/sign-in", "/forgot-password", "/auth/callback", "/api/health"] as const;

/** Need a signed-in user, but skip role and two-factor routing so the user can finish signing in. */
const AUTH_FLOW_PATHS = ["/reset-password", "/two-factor"] as const;

export const SIGN_IN_PATH = "/sign-in";
export const EXPIRED_RESET_PATH = "/forgot-password?expired=1";
export const TWO_FACTOR_SETUP_PATH = "/two-factor/setup";
export const TWO_FACTOR_VERIFY_PATH = "/two-factor/verify";

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
  /** From `mfa.getAuthenticatorAssuranceLevel()`. Only read for platform users. */
  currentLevel: string | null;
  nextLevel: string | null;
};

/** "allow", or the path to redirect to. */
export type RouteDecision = "allow" | (string & {});

function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}

/** Where a platform user must go before any other page, or null when two-factor is complete. */
function twoFactorGate(pathname: string, currentLevel: string | null, nextLevel: string | null): string | null {
  if (nextLevel !== "aal2") return TWO_FACTOR_SETUP_PATH;
  if (currentLevel === "aal2") return null;
  const returnTo = matches(pathname, ["/admin"]) && pathname !== "/admin" ? pathname : null;
  return returnTo ? withNext(TWO_FACTOR_VERIFY_PATH, returnTo) : TWO_FACTOR_VERIFY_PATH;
}

export function decideRoute({ pathname, signedIn, kind, currentLevel, nextLevel }: RouteInput): RouteDecision {
  if (!signedIn) {
    if (matches(pathname, PUBLIC_PATHS)) return "allow";
    if (matches(pathname, ["/reset-password"])) return EXPIRED_RESET_PATH;
    return pathname === "/" ? SIGN_IN_PATH : withNext(SIGN_IN_PATH, pathname);
  }

  if (matches(pathname, AUTH_FLOW_PATHS)) return "allow";
  if (pathname !== SIGN_IN_PATH && matches(pathname, PUBLIC_PATHS)) return "allow";

  const home = homeFor(kind);
  if (!home) {
    // Signed in without an organisation: only Sign in is useful, and redirecting it to itself would loop.
    return pathname === SIGN_IN_PATH ? "allow" : SIGN_IN_PATH;
  }

  if (kind === "platform") {
    const gate = twoFactorGate(pathname, currentLevel, nextLevel);
    if (gate) return gate;
  }

  if (pathname === "/" || pathname === SIGN_IN_PATH) return home;
  if (isOtherRolePath(pathname, kind)) return home;
  return "allow";
}
