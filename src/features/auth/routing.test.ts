import { describe, expect, it } from "vitest";
import { decideRoute, homeFor, isOtherRolePath, safeNextPath, type RouteInput } from "./routing";

const signedOut: RouteInput = { pathname: "/", signedIn: false, kind: null, currentLevel: null, nextLevel: null };
const buyer: RouteInput = { pathname: "/buyer", signedIn: true, kind: "buyer", currentLevel: "aal1", nextLevel: "aal1" };
const supplier: RouteInput = { ...buyer, pathname: "/supplier", kind: "supplier" };
const adminDone: RouteInput = { pathname: "/admin", signedIn: true, kind: "platform", currentLevel: "aal2", nextLevel: "aal2" };
const adminNeedsCode: RouteInput = { ...adminDone, currentLevel: "aal1", nextLevel: "aal2" };
const adminNoFactor: RouteInput = { ...adminDone, currentLevel: "aal1", nextLevel: "aal1" };

describe("decideRoute: signed out", () => {
  it.each(["/sign-in", "/forgot-password", "/auth/callback", "/api/health", "/api/health/deep"])("allows public %s", (pathname) => {
    expect(decideRoute({ ...signedOut, pathname })).toBe("allow");
  });

  it("sends the root to Sign in without a next parameter", () => {
    expect(decideRoute(signedOut)).toBe("/sign-in");
  });

  it("sends a protected page to Sign in and returns there afterwards", () => {
    expect(decideRoute({ ...signedOut, pathname: "/buyer/orders" })).toBe("/sign-in?next=%2Fbuyer%2Forders");
  });

  it("sends two-factor pages to Sign in", () => {
    expect(decideRoute({ ...signedOut, pathname: "/two-factor/verify" })).toBe("/sign-in?next=%2Ftwo-factor%2Fverify");
  });

  it("treats Set a new password without a session as an expired link", () => {
    expect(decideRoute({ ...signedOut, pathname: "/reset-password" })).toBe("/forgot-password?expired=1");
  });

  it("does not treat look-alike paths as public", () => {
    expect(decideRoute({ ...signedOut, pathname: "/sign-in-now" })).toBe("/sign-in?next=%2Fsign-in-now");
  });
});

describe("decideRoute: auth flow pages skip role and two-factor routing", () => {
  it.each(["/reset-password", "/two-factor/setup", "/two-factor/verify"])("allows %s for an admin without two-factor", (pathname) => {
    expect(decideRoute({ ...adminNoFactor, pathname })).toBe("allow");
    expect(decideRoute({ ...adminNeedsCode, pathname })).toBe("allow");
  });

  it("allows a buyer to set a new password", () => {
    expect(decideRoute({ ...buyer, pathname: "/reset-password" })).toBe("allow");
  });

  it("allows public pages other than Sign in while signed in", () => {
    expect(decideRoute({ ...adminNoFactor, pathname: "/auth/callback" })).toBe("allow");
    expect(decideRoute({ ...buyer, pathname: "/forgot-password" })).toBe("allow");
    expect(decideRoute({ ...adminNeedsCode, pathname: "/api/health" })).toBe("allow");
  });
});

describe("decideRoute: platform two-factor", () => {
  it("sends an admin without a verified factor to setup from any page", () => {
    for (const pathname of ["/admin", "/admin/orders", "/", "/sign-in", "/buyer"]) {
      expect(decideRoute({ ...adminNoFactor, pathname })).toBe("/two-factor/setup");
    }
  });

  it("treats an unknown assurance level as no factor", () => {
    expect(decideRoute({ ...adminDone, currentLevel: null, nextLevel: null })).toBe("/two-factor/setup");
  });

  it("asks an admin with a factor for a code before any admin page", () => {
    expect(decideRoute(adminNeedsCode)).toBe("/two-factor/verify");
    expect(decideRoute({ ...adminNeedsCode, pathname: "/" })).toBe("/two-factor/verify");
    expect(decideRoute({ ...adminNeedsCode, pathname: "/sign-in" })).toBe("/two-factor/verify");
  });

  it("returns to the admin page asked for after the code", () => {
    expect(decideRoute({ ...adminNeedsCode, pathname: "/admin/users" })).toBe("/two-factor/verify?next=%2Fadmin%2Fusers");
  });

  it("allows admin pages at aal2", () => {
    expect(decideRoute(adminDone)).toBe("allow");
    expect(decideRoute({ ...adminDone, pathname: "/admin/settings" })).toBe("allow");
  });

  it("sends an aal2 admin from the root and Sign in to admin home", () => {
    expect(decideRoute({ ...adminDone, pathname: "/" })).toBe("/admin");
    expect(decideRoute({ ...adminDone, pathname: "/sign-in" })).toBe("/admin");
  });

  it("keeps an aal2 admin out of other roles' areas", () => {
    expect(decideRoute({ ...adminDone, pathname: "/buyer/orders" })).toBe("/admin");
  });
});

describe("decideRoute: buyers and suppliers", () => {
  it("does not force two-factor on buyers or suppliers", () => {
    expect(decideRoute(buyer)).toBe("allow");
    expect(decideRoute(supplier)).toBe("allow");
    expect(decideRoute({ ...buyer, currentLevel: "aal1", nextLevel: "aal2" })).toBe("allow");
  });

  it("sends the root and Sign in to the role's home", () => {
    expect(decideRoute({ ...buyer, pathname: "/" })).toBe("/buyer");
    expect(decideRoute({ ...supplier, pathname: "/sign-in" })).toBe("/supplier");
  });

  it("keeps each role in its own area", () => {
    expect(decideRoute({ ...buyer, pathname: "/admin" })).toBe("/buyer");
    expect(decideRoute({ ...buyer, pathname: "/supplier/inventory" })).toBe("/buyer");
    expect(decideRoute({ ...supplier, pathname: "/buyer" })).toBe("/supplier");
  });

  it("allows pages outside any role's area", () => {
    expect(decideRoute({ ...buyer, pathname: "/kit" })).toBe("allow");
  });
});

describe("decideRoute: signed in without an organisation", () => {
  const orphan: RouteInput = { ...buyer, kind: null };

  it("allows Sign in instead of redirecting it to itself", () => {
    expect(decideRoute({ ...orphan, pathname: "/sign-in" })).toBe("allow");
  });

  it("sends every other page to Sign in", () => {
    expect(decideRoute({ ...orphan, pathname: "/buyer" })).toBe("/sign-in");
    expect(decideRoute({ ...orphan, pathname: "/" })).toBe("/sign-in");
  });

  it("treats an unknown kind like no organisation", () => {
    expect(decideRoute({ ...orphan, kind: "toString", pathname: "/" })).toBe("/sign-in");
  });
});

describe("homeFor and isOtherRolePath", () => {
  it("maps each kind to its home", () => {
    expect(homeFor("buyer")).toBe("/buyer");
    expect(homeFor("supplier")).toBe("/supplier");
    expect(homeFor("platform")).toBe("/admin");
    expect(homeFor("constructor")).toBeNull();
    expect(homeFor(null)).toBeNull();
  });

  it("flags only other roles' areas", () => {
    expect(isOtherRolePath("/admin/users", "buyer")).toBe(true);
    expect(isOtherRolePath("/buyer", "buyer")).toBe(false);
    expect(isOtherRolePath("/buyers-guide", "supplier")).toBe(false);
    expect(isOtherRolePath("/kit", "buyer")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each(["/reset-password", "/admin/orders?tab=open", "/buyer#todo", "/"])("keeps the relative path %s", (path) => {
    expect(safeNextPath(path, "/fallback")).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "reset-password",
    "//evil.test",
    "//evil.test/reset-password",
    "/\\evil.test",
    "\\\\evil.test",
    "https://evil.test",
    "javascript:alert(1)",
    "/\t/evil.test",
    "/\n/evil.test",
  ])("rejects %j", (path) => {
    expect(safeNextPath(path, "/fallback")).toBe("/fallback");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeNextPath("/a/../reset-password", "/fallback")).toBe("/reset-password");
    expect(safeNextPath("/..//evil.test", "/fallback")).toBe("/fallback");
  });
});
