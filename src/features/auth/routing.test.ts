import { describe, expect, it } from "vitest";
import { decideRoute, homeFor, isOtherRolePath, safeNextPath, type RouteInput } from "./routing";

const signedOut: RouteInput = { pathname: "/", signedIn: false, kind: null };
const buyer: RouteInput = { pathname: "/buyer", signedIn: true, kind: "buyer" };
const supplier: RouteInput = { ...buyer, pathname: "/supplier", kind: "supplier" };
const admin: RouteInput = { pathname: "/admin", signedIn: true, kind: "platform" };

describe("decideRoute: signed out", () => {
  it.each(["/sign-in", "/sign-up", "/forgot-password", "/auth/callback", "/api/health", "/api/health/deep", "/offline"])("allows public %s", (pathname) => {
    expect(decideRoute({ ...signedOut, pathname })).toBe("allow");
  });

  it("sends the root to Sign in without a next parameter", () => {
    expect(decideRoute(signedOut)).toBe("/sign-in");
  });

  it("sends a protected page to Sign in and returns there afterwards", () => {
    expect(decideRoute({ ...signedOut, pathname: "/buyer/orders" })).toBe("/sign-in?next=%2Fbuyer%2Forders");
    expect(decideRoute({ ...signedOut, pathname: "/admin" })).toBe("/sign-in?next=%2Fadmin");
  });

  it("treats Set a new password without a session as an expired link", () => {
    expect(decideRoute({ ...signedOut, pathname: "/reset-password" })).toBe("/forgot-password?expired=1");
  });

  it("does not treat look-alike paths as public", () => {
    expect(decideRoute({ ...signedOut, pathname: "/sign-in-now" })).toBe("/sign-in?next=%2Fsign-in-now");
    expect(decideRoute({ ...signedOut, pathname: "/sign-up-free" })).toBe("/sign-in?next=%2Fsign-up-free");
  });

  it("has no two-factor pages any more", () => {
    expect(decideRoute({ ...signedOut, pathname: "/two-factor/verify" })).toBe("/sign-in?next=%2Ftwo-factor%2Fverify");
  });
});

describe("decideRoute: signed in on auth pages", () => {
  it.each([
    ["buyer", buyer, "/buyer"],
    ["supplier", supplier, "/supplier"],
    ["admin", admin, "/admin"],
  ] as const)("sends a signed-in %s from Sign in and Create an account to their home", (_role, input, home) => {
    expect(decideRoute({ ...input, pathname: "/sign-in" })).toBe(home);
    expect(decideRoute({ ...input, pathname: "/sign-up" })).toBe(home);
    expect(decideRoute({ ...input, pathname: "/" })).toBe(home);
  });

  it("allows Set a new password for every role", () => {
    expect(decideRoute({ ...buyer, pathname: "/reset-password" })).toBe("allow");
    expect(decideRoute({ ...admin, pathname: "/reset-password" })).toBe("allow");
  });

  it("allows public pages other than Sign in and Create an account", () => {
    expect(decideRoute({ ...admin, pathname: "/auth/callback" })).toBe("allow");
    expect(decideRoute({ ...buyer, pathname: "/forgot-password" })).toBe("allow");
    expect(decideRoute({ ...supplier, pathname: "/api/health" })).toBe("allow");
  });
});

describe("decideRoute: admins", () => {
  it("allows admin pages straight after password sign-in", () => {
    expect(decideRoute(admin)).toBe("allow");
    expect(decideRoute({ ...admin, pathname: "/admin/settings" })).toBe("allow");
  });

  it("keeps an admin out of other roles' areas", () => {
    expect(decideRoute({ ...admin, pathname: "/buyer/orders" })).toBe("/admin");
    expect(decideRoute({ ...admin, pathname: "/supplier" })).toBe("/admin");
  });

  it("does not route anyone to the removed two-factor pages", () => {
    expect(decideRoute({ ...admin, pathname: "/two-factor/setup" })).toBe("allow");
  });
});

describe("decideRoute: buyers and suppliers", () => {
  it("allows each role's own area", () => {
    expect(decideRoute(buyer)).toBe("allow");
    expect(decideRoute(supplier)).toBe("allow");
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

describe("decideRoute: signed in without an organisation (a Tradelink AI user)", () => {
  const orphan: RouteInput = { ...buyer, kind: null };

  it("allows Sign in instead of redirecting it to itself", () => {
    expect(decideRoute({ ...orphan, pathname: "/sign-in" })).toBe("allow");
  });

  it("allows the Tradelink AI app and its APIs", () => {
    expect(decideRoute({ ...orphan, pathname: "/r" })).toBe("allow");
    expect(decideRoute({ ...orphan, pathname: "/r/dev/cards" })).toBe("allow");
    expect(decideRoute({ ...orphan, pathname: "/api/cards/abc/act" })).toBe("allow");
  });

  it("sends every other page to the Tradelink AI app", () => {
    expect(decideRoute({ ...orphan, pathname: "/buyer" })).toBe("/r");
    expect(decideRoute({ ...orphan, pathname: "/" })).toBe("/r");
    expect(decideRoute({ ...orphan, pathname: "/sign-up" })).toBe("/r");
  });

  it("treats an unknown kind like no organisation", () => {
    expect(decideRoute({ ...orphan, kind: "toString", pathname: "/" })).toBe("/r");
  });
});

describe("decideRoute: Tradelink AI paths", () => {
  it("lets Tradelink users open the Tradelink AI app too", () => {
    expect(decideRoute({ ...buyer, pathname: "/r" })).toBe("allow");
  });

  it("keeps the Tradelink AI app behind sign-in but leaves the job runner open", () => {
    expect(decideRoute({ ...signedOut, pathname: "/r" })).toBe("/sign-in?next=%2Fr");
    expect(decideRoute({ ...signedOut, pathname: "/api/jobs/run" })).toBe("allow");
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
