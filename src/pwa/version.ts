/**
 * The web app's release, checked against `public.app_release.min_version` for platform 'web'.
 * Bump it with every release; raise `min_version` only when older clients must stop ordering.
 */
export const APP_VERSION = "0.5.0";

type ParsedVersion = { core: [number, number, number]; prerelease: string[] };

const PATTERN = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Parses "1.2.3", "1.2", "v2" or "1.2.3-beta.1+build". Returns null for anything else. */
export function parseVersion(value: string): ParsedVersion | null {
  const match = PATTERN.exec(value.trim());
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)],
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function compareIdentifiers(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return Math.sign(Number(a) - Number(b));
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Semver order: -1, 0 or 1. A prerelease sorts before its release. Null when either is not a version. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;

  for (let i = 0; i < 3; i++) {
    const diff = Math.sign(left.core[i]! - right.core[i]!);
    if (diff !== 0) return diff as -1 | 1;
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let i = 0; i < length; i++) {
    const l = left.prerelease[i];
    const r = right.prerelease[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const diff = compareIdentifiers(l, r);
    if (diff !== 0) return diff as -1 | 1;
  }
  return 0;
}

/** True only when `current` is a version below `minimum`. An unreadable version never blocks ordering. */
export function isBelowMinimum(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) === -1;
}
