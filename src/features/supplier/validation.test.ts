import { describe, expect, it } from "vitest";
import {
  acceptSchema,
  addProductSchema,
  adjustSchema,
  COPY,
  formValues,
  parseInput,
  priceSchema,
  profileSchema,
  receiveSchema,
  supplierErrorCopy,
} from "./validation";

const KEY = "7b0e1f0a-4c1d-4e8f-9a2b-3c4d5e6f7a8b";
const PRODUCT = "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const product = { name: "Red lentils 1kg", unit: "pack", price: "4.50", opening: "20", reorder: "5", category: "dry_goods", key: KEY };

describe("addProductSchema", () => {
  it("accepts a valid product and keeps the price exact", () => {
    expect(parseInput(addProductSchema, product)).toEqual({
      ok: true,
      data: { ...product, price: "4.50", opening: 20, reorder: 5 },
    });
    expect(parseInput(addProductSchema, { ...product, price: "9.4" })).toMatchObject({ ok: true, data: { price: "9.40" } });
  });

  it("collapses spaces in the name", () => {
    expect(parseInput(addProductSchema, { ...product, name: "  Red   lentils " })).toMatchObject({
      data: { name: "Red lentils" },
    });
  });

  it("uses the story copy for each field", () => {
    expect(parseInput(addProductSchema, { ...product, name: " a " })).toEqual({ ok: false, error: COPY.productName });
    expect(parseInput(addProductSchema, { ...product, price: "0" })).toEqual({ ok: false, error: COPY.price });
    expect(parseInput(addProductSchema, { ...product, price: "100000" })).toEqual({ ok: false, error: COPY.price });
    expect(parseInput(addProductSchema, { ...product, price: "4.555" })).toEqual({ ok: false, error: COPY.price });
    expect(parseInput(addProductSchema, { ...product, opening: "2.5" })).toEqual({ ok: false, error: COPY.opening });
    expect(parseInput(addProductSchema, { ...product, opening: "" })).toEqual({ ok: false, error: COPY.opening });
    expect(parseInput(addProductSchema, { ...product, reorder: "-1" })).toEqual({ ok: false, error: COPY.reorder });
  });
});

describe("stock forms", () => {
  const base = { productId: PRODUCT, key: KEY, productName: "Tofu" };

  it("takes whole numbers from 1 to 9999 when receiving", () => {
    expect(parseInput(receiveSchema, { ...base, qty: "30" })).toMatchObject({ ok: true, data: { qty: 30 } });
    for (const qty of ["0", "10000", "1.5", "abc"]) {
      expect(parseInput(receiveSchema, { ...base, qty })).toEqual({ ok: false, error: COPY.quantity });
    }
  });

  it("refuses a zero adjustment and needs a reason", () => {
    expect(parseInput(adjustSchema, { ...base, change: "0", reason: "damaged", note: "" })).toEqual({
      ok: false,
      error: COPY.change,
    });
    expect(parseInput(adjustSchema, { ...base, change: "-3", reason: "", note: "" })).toEqual({
      ok: false,
      error: COPY.reason,
    });
    expect(parseInput(adjustSchema, { ...base, change: "-3", reason: "expired", note: " Past date " })).toMatchObject({
      ok: true,
      data: { change: -3, note: "Past date" },
    });
  });

  it("checks new prices", () => {
    expect(parseInput(priceSchema, { ...base, price: "99999" })).toMatchObject({ ok: true, data: { price: "99999.00" } });
    expect(parseInput(priceSchema, { ...base, price: "-2" })).toEqual({ ok: false, error: COPY.price });
  });
});

describe("acceptSchema", () => {
  it("needs a real date", () => {
    const order = { orderId: PRODUCT, key: KEY };
    expect(parseInput(acceptSchema, { ...order, date: "2026-11-04" }).ok).toBe(true);
    expect(parseInput(acceptSchema, { ...order, date: "2026-13-01" })).toEqual({ ok: false, error: COPY.date });
  });
});

describe("profileSchema", () => {
  const profile = {
    contact: "Ahmad Tan",
    phone: "+65 6123 4567",
    email: "orders@harbour.sg",
    address: "12 Pandan Loop",
    range: "Rice, oil and dry goods",
    days: ["6", "1", "2", "2"],
    lead: "1",
    cutoff: "16:00",
    minimum: "80",
  };

  it("accepts a full profile and sorts delivery days", () => {
    expect(parseInput(profileSchema, profile)).toMatchObject({ ok: true, data: { days: [1, 2, 6], lead: 1, minimum: "80.00" } });
    expect(parseInput(profileSchema, { ...profile, minimum: "0" })).toMatchObject({ ok: true, data: { minimum: "0.00" } });
  });

  it("explains each invalid field", () => {
    expect(parseInput(profileSchema, { ...profile, days: [] })).toEqual({ ok: false, error: COPY.days });
    expect(parseInput(profileSchema, { ...profile, cutoff: "25:00" })).toEqual({ ok: false, error: COPY.cutoff });
    expect(parseInput(profileSchema, { ...profile, email: "orders" })).toEqual({ ok: false, error: COPY.email });
    expect(parseInput(profileSchema, { ...profile, phone: "call me" })).toEqual({ ok: false, error: COPY.phone });
    expect(parseInput(profileSchema, { ...profile, lead: "15" })).toEqual({ ok: false, error: COPY.lead });
  });
});

describe("formValues", () => {
  it("reads strings and treats missing fields as empty", () => {
    const form = new FormData();
    form.set("qty", "3");
    expect(formValues(form, ["qty", "key"])).toEqual({ qty: "3", key: "" });
  });
});

describe("supplierErrorCopy", () => {
  it("maps database refusals to story copy", () => {
    expect(supplierErrorCopy({ error: "x", reason: "CONFIRM_STOCK_FIRST", detail: "Tofu" })).toBe("Confirm stock for Tofu first.");
    expect(supplierErrorCopy({ error: "x", reason: "DUPLICATE", detail: "Tofu" })).toBe(COPY.duplicate);
    expect(supplierErrorCopy({ error: "x", reason: "STOCK_SHORT", detail: "[]" })).toBe(COPY.stockShort);
    expect(supplierErrorCopy({ error: "x", reason: "INVALID_INPUT", detail: "enter 0 to 6 for Eggs" })).toBe(
      "Enter 0 to 6 for Eggs.",
    );
    expect(
      supplierErrorCopy({ error: "x", reason: "INVALID_INPUT", detail: "delivery date must be today or later" }),
    ).toBe(COPY.date);
  });

  it("keeps the shared copy for everything else", () => {
    expect(supplierErrorCopy({ error: "You do not have access to do that.", reason: "INVALID_TRANSITION" })).toBe(
      "You do not have access to do that.",
    );
  });
});
