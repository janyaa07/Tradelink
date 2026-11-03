import { describe, expect, it } from "vitest";
import { codeErrorMessage, formatSecret, parseTotpCode, TWO_FACTOR_MESSAGES } from "./twoFactor";

describe("parseTotpCode", () => {
  it.each([
    ["123456", "123456"],
    [" 123 456 ", "123456"],
    ["123-456", "123456"],
    ["000000", "000000"],
  ])("reads %j as %j", (input, code) => {
    expect(parseTotpCode(input)).toBe(code);
  });

  it.each(["", "12345", "1234567", "12345a", "١٢٣٤٥٦"])("rejects %j", (input) => {
    expect(parseTotpCode(input)).toBeNull();
  });
});

describe("codeErrorMessage", () => {
  it("says the code did not match for a wrong or stale code", () => {
    expect(codeErrorMessage({ code: "mfa_verification_failed", status: 422 })).toBe("That code did not match. Try the current code.");
    expect(codeErrorMessage({ code: "mfa_challenge_expired", status: 422 })).toBe(TWO_FACTOR_MESSAGES.mismatch);
  });

  it("explains rate limiting", () => {
    expect(codeErrorMessage({ code: "over_request_rate_limit", status: 429 })).toBe(TWO_FACTOR_MESSAGES.tooMany);
  });

  it("falls back to a retry message", () => {
    expect(codeErrorMessage({ code: "unexpected_failure", status: 500 })).toBe(TWO_FACTOR_MESSAGES.failed);
    expect(codeErrorMessage({})).toBe(TWO_FACTOR_MESSAGES.failed);
  });
});

describe("formatSecret", () => {
  it("groups the secret in fours", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(formatSecret("JBSWY3DPEH")).toBe("JBSW Y3DP EH");
    expect(formatSecret("")).toBe("");
  });
});
