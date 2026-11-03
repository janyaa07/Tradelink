import { z } from "zod";

export const ORDER_STATES = ["DRAFT", "AWAITING_CONFIRM", "CONFIRMED", "CANCELLED"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

const cents = z.number().int().min(0);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const OrderSummaryLineSchema = z.object({
  lineId: z.guid(),
  /** "Brand name variant pack size" from the product, or the owner's words while it needs a pick. */
  itemName: z.string().min(1).max(240),
  needsPick: z.boolean(),
  qty: z.number().int().min(1).max(9999).nullable(),
  orderUnit: z.string().max(30).nullable(),
  unitPriceCents: cents.nullable(),
  lineTotalCents: cents.nullable(),
  /** Weighed (per kg) or market-priced, so the total is an estimate. */
  approx: z.boolean(),
});
export type OrderSummaryLine = z.infer<typeof OrderSummaryLineSchema>;

export const OrderSummaryGroupSchema = z.object({
  /** Null for lines that still need the owner's pick. */
  supplierId: z.guid().nullable(),
  supplierName: z.string().min(1).max(120),
  deliveryDate: isoDate.nullable(),
  paymentNote: z.string().max(60).nullable(),
  minimumOrderCents: cents.nullable(),
  belowMinimum: z.boolean(),
  subtotalCents: cents,
  approx: z.boolean(),
  unknownPriceCount: z.number().int().min(0),
  purchaseOrderNumber: z.number().int().nullable(),
  lines: z.array(OrderSummaryLineSchema).min(1),
});
export type OrderSummaryGroup = z.infer<typeof OrderSummaryGroupSchema>;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const OrderSummaryDataSchema = z
  .object({
    orderId: z.guid(),
    orderState: z.enum(ORDER_STATES),
    createdAt: z.string(),
    groups: z.array(OrderSummaryGroupSchema),
    skippedCount: z.number().int().min(0),
    needsPickCount: z.number().int().min(0),
    unknownPriceCount: z.number().int().min(0),
    approx: z.boolean(),
    totalCents: cents,
  })
  .superRefine((data, ctx) => {
    for (const group of data.groups) {
      const lines = sum(group.lines.map((line) => line.lineTotalCents ?? 0));
      if (lines !== group.subtotalCents) ctx.addIssue({ code: "custom", message: `Subtotal for ${group.supplierName} does not add up.` });
    }
    if (sum(data.groups.map((group) => group.subtotalCents)) !== data.totalCents) {
      ctx.addIssue({ code: "custom", message: "The order total does not add up." });
    }
  });
export type OrderSummaryData = z.infer<typeof OrderSummaryDataSchema>;
