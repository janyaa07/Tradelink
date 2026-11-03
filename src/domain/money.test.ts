import { describe, expect, it } from "vitest";
import { formatMoney, fromCents, lineTotal, toCents } from "./money";

describe("money", () => {
  it("parses decimal strings into cents", () => {
    expect(toCents("52.00")).toBe(5200);
    expect(toCents("8.9")).toBe(890);
    expect(toCents("0.05")).toBe(5);
    expect(toCents("-4.20")).toBe(-420);
  });

  it("rejects values that are not money", () => {
    expect(() => toCents("1.234")).toThrow();
    expect(() => toCents("abc")).toThrow();
  });

  it("formats in Singapore dollars with two decimals", () => {
    expect(formatMoney("52")).toBe("S$52.00");
    expect(formatMoney(15940)).toBe("S$159.40");
    expect(formatMoney(123456789)).toBe("S$1,234,567.89");
  });

  it("multiplies line totals without floating point drift", () => {
    expect(lineTotal("1.10", 3)).toBe(330);
    expect(fromCents(lineTotal("8.90", 6))).toBe("53.40");
  });
});
