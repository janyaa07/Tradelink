/**
 * The origin to put in emailed links (AUTH-03). A spoofed Host header must never decide where
 * a password reset link points, so the request is checked against an allowlist: the configured
 * NEXT_PUBLIC_SITE_URL when set, otherwise the request's own host.
 */

const HOST_PATTERN = /^(?:\[[0-9a-f:.]+\]|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?::\d{1,5})?$/;
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;

type OriginInput = {
  /** The `x-forwarded-proto` header. Proxies may send a list; the first value is the client's. */
  forwardedProto: string | null;
  /** The `host` header. */
  host: string | null;
  /** NEXT_PUBLIC_SITE_URL. Empty means "not set". */
  siteUrl: string | null | undefined;
};

/** "https://tradelink.example" for a valid http(s) URL, otherwise null. */
export function parseOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** The origin the request claims to come from, or null when its headers are malformed. */
export function requestOrigin(forwardedProto: string | null, host: string | null): string | null {
  const cleanHost = host?.trim().toLowerCase() ?? "";
  if (!HOST_PATTERN.test(cleanHost)) return null;
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase() || (LOCAL_HOST.test(cleanHost) ? "http" : "https");
  if (proto !== "https" && proto !== "http") return null;
  return parseOrigin(`${proto}://${cleanHost}`);
}

/** The allowlisted origin for emailed links, or null when none can be trusted. */
export function resolveOrigin({ forwardedProto, host, siteUrl }: OriginInput): string | null {
  const configured = parseOrigin(siteUrl);
  if (configured) return configured;
  if (siteUrl?.trim()) return null; // Set but invalid: fail closed rather than trust the request.
  return requestOrigin(forwardedProto, host);
}
