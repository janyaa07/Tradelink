import { describe, expect, it } from "vitest";
import { APP_VERSION, compareVersions, isBelowMinimum, parseVersion } from "./version";

describe("parseVersion", () => {
  it("reads full, short and prefixed versions", () => {
    expect(parseVersion("1.2.3")).toEqual({ core: [1, 2, 3], prerelease: [] });
    expect(parseVersion("1.2")).toEqual({ core: [1, 2, 0], prerelease: [] });
    expect(parseVersion("v2")).toEqual({ core: [2, 0, 0], prerelease: [] });
    expect(parseVersion(" 1.0.0-beta.2+sha.5 ")).toEqual({ core: [1, 0, 0], prerelease: ["beta", "2"] });
  });

  it("rejects anything else", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2.3.4")).toBeNull();
    expect(parseVersion("1..2")).toBeNull();
  });
});

describe("compareVersions", () => {
  it.each([
    ["0.5.0", "0.5.0", 0],
    ["0.5.0", "0.5", 0],
    ["0.4.9", "0.5.0", -1],
    ["0.10.0", "0.9.0", 1],
    ["1.0.0", "0.99.99", 1],
    ["2.0.0", "10.0.0", -1],
    ["0.5.1", "0.5.0", 1],
  ] as const)("compares %s with %s numerically", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it("orders prereleases as semver does", () => {
    const ordered = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(compareVersions(ordered[i]!, ordered[i + 1]!), `${ordered[i]} < ${ordered[i + 1]}`).toBe(-1);
      expect(compareVersions(ordered[i + 1]!, ordered[i]!)).toBe(1);
    }
  });

  it("ignores build metadata", () => {
    expect(compareVersions("1.0.0+a", "1.0.0+b")).toBe(0);
  });

  it("returns null for an unreadable version", () => {
    expect(compareVersions("abc", "1.0.0")).toBeNull();
    expect(compareVersions("1.0.0", "")).toBeNull();
  });
});

describe("isBelowMinimum", () => {
  it("blocks only a lower version", () => {
    expect(isBelowMinimum("0.4.0", "0.5.0")).toBe(true);
    expect(isBelowMinimum("0.5.0", "0.5.0")).toBe(false);
    expect(isBelowMinimum("0.6.0", "0.5.0")).toBe(false);
    expect(isBelowMinimum("0.5.0-rc.1", "0.5.0")).toBe(true);
  });

  it("never blocks on an unreadable version", () => {
    expect(isBelowMinimum("0.5.0", "soon")).toBe(false);
    expect(isBelowMinimum("dev", "0.5.0")).toBe(false);
  });

  it("ships a version the seeded minimum allows", () => {
    expect(isBelowMinimum(APP_VERSION, "0.5.0")).toBe(false);
  });
});
