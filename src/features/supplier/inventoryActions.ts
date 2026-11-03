"use server";

import { requireRole } from "@/data/session";
import { runRpc, type FormResult } from "./respond";
import {
  addProductSchema,
  adjustSchema,
  confirmSchema,
  formValues,
  parseInput,
  priceSchema,
  receiveSchema,
} from "./validation";

/** Adds a product connected buyers can order straight away (SUP-11). The picture is guessed from the name. */
export async function addProductAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(
    addProductSchema,
    formValues(form, ["key", "name", "unit", "price", "opening", "reorder", "category"]),
  );
  if (!input.ok) return input;
  const { key, name, unit, price, opening, reorder, category } = input.data;
  return runRpc(
    "supplier_add_product",
    {
      p_name: name,
      p_unit: unit,
      p_price: price,
      p_opening: opening,
      p_reorder: reorder,
      p_category: category,
      p_art: null,
      p_key: key,
    },
    () => `${name} added. Buyers can now order it.`,
  );
}

/** Receive stock (SUP-12). Receiving an unconfirmed product also confirms it. */
export async function receiveStockAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(receiveSchema, formValues(form, ["productId", "key", "productName", "qty"]));
  if (!input.ok) return input;
  const { productId, key, productName, qty } = input.data;
  return runRpc("receive_stock", { p_product: productId, p_qty: qty, p_key: key }, () => `Added ${qty} to ${productName}.`);
}

/** Confirm stock for a product a buyer added: quantity, price and reorder level (SUP-13). */
export async function confirmStockAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(
    confirmSchema,
    formValues(form, ["productId", "key", "productName", "qty", "price", "reorder"]),
  );
  if (!input.ok) return input;
  const { productId, key, productName, qty, price, reorder } = input.data;
  return runRpc(
    "confirm_product_stock",
    { p_product: productId, p_qty: qty, p_price: price, p_reorder: reorder, p_key: key },
    () => `Added ${qty} to ${productName}.`,
  );
}

/** Change price (SUP-14). The same price changes nothing and shows no toast. */
export async function changePriceAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(priceSchema, formValues(form, ["productId", "key", "productName", "price"]));
  if (!input.ok) return input;
  return runRpc<{ changed: boolean }>(
    "change_price",
    { p_product: input.data.productId, p_price: input.data.price, p_key: input.data.key },
    (data) => (data.changed ? "Price updated. Buyers who order this item will be told." : ""),
  );
}

/** Adjust stock for damage, expiry or a count correction (SUP-15). */
export async function adjustStockAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const input = parseInput(adjustSchema, formValues(form, ["productId", "key", "productName", "change", "reason", "note"]));
  if (!input.ok) return input;
  const { productId, key, change, reason, note } = input.data;
  return runRpc(
    "adjust_stock",
    { p_product: productId, p_change: change, p_reason: reason, p_note: note || null, p_key: key },
    () => "Stock adjusted.",
  );
}
