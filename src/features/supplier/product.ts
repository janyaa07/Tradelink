import type { Category } from "@/domain/catalogue";

/** The category the database guesses from a product name (app.kind_of), so the form can start with it. */
const GUESSES: [RegExp, Category][] = [
  [/egg/, "fresh"],
  [/rice|sugar|flour/, "dry_goods"],
  [/oil/, "oils_sauces"],
  [/milk/, "dry_goods"],
  [/noodle/, "dry_goods"],
  [/tissue/, "supplies"],
  [/chilli|sauce|paste/, "oils_sauces"],
  [/tofu/, "fresh"],
  [/onion|veg|herb/, "fresh"],
  [/soap|clean/, "supplies"],
];

export function guessCategory(name: string): Category {
  const lower = name.toLowerCase();
  return GUESSES.find(([pattern]) => pattern.test(lower))?.[1] ?? "supplies";
}

export type PartLine = { productId: string; name: string; qty: number };
export type SendLine = { productId: string; sendQty: number };

export type PartCheck = { ok: true; lines: SendLine[]; rejectsOrder: boolean } | { ok: false; error: string; productId: string };

/**
 * Checks "How much can you send?" (SUP-05): each value is a whole number from 0 to the ordered
 * quantity. Sending nothing at all rejects the order instead.
 */
export function checkPartQuantities(lines: PartLine[], values: Record<string, string>): PartCheck {
  const send: SendLine[] = [];
  for (const line of lines) {
    const raw = (values[line.productId] ?? "").trim();
    const qty = Number(raw);
    if (!/^\d+$/.test(raw) || qty > line.qty) {
      return { ok: false, error: `Enter 0 to ${line.qty} for ${line.name}.`, productId: line.productId };
    }
    send.push({ productId: line.productId, sendQty: qty });
  }
  return { ok: true, lines: send, rejectsOrder: send.every((line) => line.sendQty === 0) };
}
