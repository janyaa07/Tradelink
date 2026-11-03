import { describe, expect, it } from "vitest";
import { PASSWORD_MESSAGES, passwordUpdateError, validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("accepts 12 or more matching characters", () => {
    expect(validateNewPassword("correct horse", "correct horse")).toBeNull();
    expect(validateNewPassword("a".repeat(12), "a".repeat(12))).toBeNull();
  });

  it("asks for at least 12 characters", () => {
    expect(validateNewPassword("a".repeat(11), "a".repeat(11))).toEqual({ password: "Use at least 12 characters." });
    expect(validateNewPassword("", "")).toEqual({ password: "Use at least 12 characters." });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(validateNewPassword("🔑".repeat(11), "🔑".repeat(11))).toEqual({ password: PASSWORD_MESSAGES.tooShort });
  });

  it("says when the passwords do not match", () => {
    expect(validateNewPassword("long enough pass", "long enough pasS")).toEqual({ confirm: "The passwords do not match." });
  });

  it("reports both problems at once", () => {
    expect(validateNewPassword("short", "other")).toEqual({
      password: "Use at least 12 characters.",
      confirm: "The passwords do not match.",
    });
  });

  it("rejects passwords longer than bcrypt reads", () => {
    expect(validateNewPassword("a".repeat(72), "a".repeat(72))).toBeNull();
    expect(validateNewPassword("a".repeat(73), "a".repeat(73))).toEqual({ password: "Use 72 characters or fewer." });
    expect(validateNewPassword("é".repeat(37), "é".repeat(37))).toEqual({ password: PASSWORD_MESSAGES.tooLong });
  });
});

describe("passwordUpdateError", () => {
  it("explains a weak or leaked password", () => {
    const weak = "Choose a stronger password. This one has appeared in a data breach or is too weak.";
    expect(passwordUpdateError({ code: "weak_password" })).toBe(weak);
    expect(passwordUpdateError({ name: "AuthWeakPasswordError" })).toBe(weak);
  });

  it("asks for a different password when it is unchanged", () => {
    expect(passwordUpdateError({ code: "same_password" })).toBe(PASSWORD_MESSAGES.samePassword);
  });

  it("falls back to a retry message", () => {
    expect(passwordUpdateError({ code: "unexpected_failure" })).toBe("We could not update your password. Try again.");
  });
});
