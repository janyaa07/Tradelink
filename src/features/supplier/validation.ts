import { z } from "zod";
import { CATEGORIES, UNITS } from "@/domain/catalogue";
import { fromCents, toCents } from "@/domain/money";
import { isIsoDate } from "./dates";
import { ISSUE_ANSWERS } from "./issues";
import { isCutoffTime } from "./profile";

/** User copy from docs/USER_STORIES.md (SUP-04 to SUP-18). */
export const COPY = {
  invalid: "Check the details and try again.",
  date: "Choose today or a later delivery date.",
  stockShort: "There is not enough stock to accept this order. Receive stock first.",
  productName: "Enter a product name.",
  duplicate: "You already have a product with this name.",
  price: "Enter a price above 0.",
  opening: "Enter opening stock as a whole number.",
  reorder: "Enter the reorder level as a whole number.",
  quantity: "Enter a whole number between 1 and 9999.",
  change: "Enter a whole number between -9999 and 9999, other than 0.",
  reason: "Choose a reason.",
  note: "Keep the note under 500 characters.",
  contact: "Enter the contact person's name.",
  phone: "Enter a phone number, such as +65 6123 4567.",
  email: "Enter an email address, such as orders@example.sg.",
  address: "Keep the address under 200 characters.",
  range: "Keep the product range under 200 characters.",
  days: "Choose at least one delivery day.",
  lead: "Enter a lead time from 0 to 14 days.",
  cutoff: "Enter the cut-off as a 24-hour time, such as 16:00.",
  minimum: "Enter a minimum order from S$0.00 to S$99,999.00.",
} as const;

const id = z.uuid({ error: COPY.invalid });
const key = z.uuid({ error: COPY.invalid });
const label = z.string().trim().min(1, COPY.invalid).max(120, COPY.invalid);

function wholeNumber(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .regex(/^-?\d{1,6}$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));
}

/** A money amount typed in dollars, returned as an exact decimal string such as "9.40". */
function money(minCents: number, maxCents: number, message: string) {
  return z
    .string()
    .trim()
    .regex(/^\d{1,5}(\.\d{1,2})?$/, message)
    .transform((value) => toCents(value))
    .pipe(z.number().int().min(minCents, message).max(maxCents, message))
    .transform(fromCents);
}

const price = money(1, 9_999_900, COPY.price);

export const orderSchema = z.object({ orderId: id, key });

export const acceptSchema = orderSchema.extend({
  date: z.string().trim().refine(isIsoDate, COPY.date),
});

export const answerSchema = z.object({
  issueId: id,
  key,
  answer: z.enum(ISSUE_ANSWERS, { error: COPY.invalid }),
  buyerName: label,
});

export const addProductSchema = z.object({
  key,
  name: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(2, COPY.productName).max(80, COPY.productName)),
  unit: z.enum(UNITS, { error: COPY.invalid }),
  price,
  opening: wholeNumber(0, 9999, COPY.opening),
  reorder: wholeNumber(0, 99999, COPY.reorder),
  category: z.enum(CATEGORIES, { error: COPY.invalid }),
});

const productSchema = z.object({ productId: id, key, productName: label });

export const receiveSchema = productSchema.extend({ qty: wholeNumber(1, 9999, COPY.quantity) });

export const confirmSchema = productSchema.extend({
  qty: wholeNumber(1, 9999, COPY.quantity),
  price,
  reorder: wholeNumber(0, 99999, COPY.reorder),
});

export const priceSchema = productSchema.extend({ price });

export const adjustSchema = productSchema.extend({
  change: wholeNumber(-9999, 9999, COPY.change).refine((value) => value !== 0, COPY.change),
  reason: z.enum(["damaged", "expired", "count_correction"], { error: COPY.reason }),
  note: z.string().trim().max(500, COPY.note),
});

export const profileSchema = z.object({
  contact: z.string().trim().min(2, COPY.contact).max(120, COPY.contact),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, COPY.phone),
  email: z.string().trim().max(254, COPY.email).pipe(z.email({ error: COPY.email })),
  address: z.string().trim().max(200, COPY.address),
  range: z.string().trim().max(200, COPY.range),
  days: z
    .array(z.string().regex(/^[1-7]$/, COPY.days).transform(Number))
    .min(1, COPY.days)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  lead: wholeNumber(0, 14, COPY.lead),
  cutoff: z.string().trim().refine(isCutoffTime, COPY.cutoff),
  minimum: money(0, 9_999_900, COPY.minimum),
});

/** Reads text fields from a submitted form. Missing fields read as empty strings. */
export function formValues<K extends string>(form: FormData, names: readonly K[]): Record<K, string> {
  const values = {} as Record<K, string>;
  for (const name of names) {
    const value = form.get(name);
    values[name] = typeof value === "string" ? value : "";
  }
  return values;
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

/** Validates input and returns the first message to show under the form. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): Parsed<z.output<T>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? COPY.invalid };
}

type RpcFailure = { error: string; reason?: string; detail?: string };

/** Turns a database refusal into the supplier copy from the stories. */
export function supplierErrorCopy(failure: RpcFailure): string {
  const detail = failure.detail ?? "";
  switch (failure.reason) {
    case "CONFIRM_STOCK_FIRST":
      return detail ? `Confirm stock for ${detail} first.` : failure.error;
    case "DUPLICATE":
      return COPY.duplicate;
    case "STOCK_SHORT":
      return COPY.stockShort;
    case "INVALID_INPUT": {
      const part = /^enter 0 to (\d+) for (.+)$/.exec(detail);
      if (part) return `Enter 0 to ${part[1]} for ${part[2]}.`;
      if (detail.startsWith("delivery date")) return COPY.date;
      return failure.error;
    }
    default:
      return failure.error;
  }
}
