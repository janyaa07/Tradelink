import { describe, expect, it } from "vitest";
import { checkPartQuantities, guessCategory } from "./product";

describe("guessCategory", () => {
  it("matches the database guess from the name", () => {
    expect(guessCategory("Eggs (tray of 30)")).toBe("fresh");
    expect(guessCategory("Jasmine Rice 10kg")).toBe("dry_goods");
    expect(guessCategory("Sesame oil 1L")).toBe("oils_sauces");
    expect(guessCategory("Paper cups")).toBe("supplies");
  });
});

describe("checkPartQuantities", () => {
  const lines = [
    { productId: "a", name: "Eggs (tray of 30)", qty: 6 },
    { productId: "b", name: "Jasmine rice 10kg", qty: 2 },
  ];

  it("accepts whole numbers from 0 to the ordered quantity", () => {
    expect(checkPartQuantities(lines, { a: "4", b: "0" })).toEqual({
      ok: true,
      lines: [
        { productId: "a", sendQty: 4 },
        { productId: "b", sendQty: 0 },
      ],
      rejectsOrder: false,
    });
  });

  it("names the line and its range when a value is out of range", () => {
    expect(checkPartQuantities(lines, { a: "7", b: "1" })).toEqual({
      ok: false,
      error: "Enter 0 to 6 for Eggs (tray of 30).",
      productId: "a",
    });
    expect(checkPartQuantities(lines, { a: "2", b: "-1" })).toMatchObject({ ok: false, productId: "b" });
    expect(checkPartQuantities(lines, { a: "1.5", b: "1" })).toMatchObject({ ok: false, productId: "a" });
    expect(checkPartQuantities(lines, { a: "", b: "1" })).toMatchObject({ ok: false, productId: "a" });
  });

  it("treats all zeros as a rejection", () => {
    expect(checkPartQuantities(lines, { a: "0", b: "0" })).toMatchObject({ ok: true, rejectsOrder: true });
  });
});
