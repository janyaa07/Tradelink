import { describe, expect, it } from "vitest";
import { CardError } from "../errors";
import { fakeDb } from "../testing/fake-db";
import { AH_HUAT, FRESH, KL, LINES, ORDER, OTHER_SHOP, SHOP } from "../testing/fixtures";
import { buildOrderSummary } from "./build";
import { OrderSummaryDataSchema } from "./schema";
import { itemName, NOT_READY_GROUP, summarizeOrder, withQuantities, type SummaryLineInput } from "./summary";

const item = (name: string, supplierId: string | null, billingType: "fixed" | "per_kg" | "market" = "fixed", orderUnit = "unit") => ({
  name,
  supplierId,
  billingType,
  orderUnit,
});

const line = (n: number, overrides: Partial<SummaryLineInput>): SummaryLineInput => ({
  lineId: LINES[n] ?? LINES[0],
  position: n + 1,
  rawText: "",
  qty: 1,
  status: "PICKED",
  priceCents: null,
  deliveryDate: null,
  item: null,
  ...overrides,
});

const SUPPLIERS = [
  { supplierId: AH_HUAT, name: "Ah Huat Trading", minimumOrderCents: 5000, paymentTerms: "cod" },
  { supplierId: KL, name: "KL Trading", minimumOrderCents: 8000, paymentTerms: "14d" },
  { supplierId: FRESH, name: "FreshPoultry", minimumOrderCents: 3000, paymentTerms: "7d" },
];

const DEMO_LINES = [
  line(0, { qty: 2, priceCents: 540, item: item("Seng Choon Eggs Fresh tray of 30", AH_HUAT, "fixed", "tray"), deliveryDate: "2026-11-05" }),
  line(1, { qty: 3, priceCents: 4580, item: item("Cooking oil Palm 17L tin", KL, "fixed", "tin") }),
  line(2, { qty: 5, priceCents: 680, item: item("CP Chicken mid-wing Frozen 1kg pack", FRESH, "per_kg", "kg") }),
  line(3, { qty: 1, priceCents: null, item: item("MDH Chaat masala 100g", KL, "fixed", "box") }),
  line(4, { qty: null, rawText: "taugeh", item: null, status: "OPEN" }),
];

const summarize = (lines: SummaryLineInput[] = DEMO_LINES) =>
  summarizeOrder({ orderId: ORDER, orderState: "AWAITING_CONFIRM", createdAt: "2026-11-03T08:00:00Z", lines, suppliers: SUPPLIERS, purchaseOrders: [] });

describe("summarizeOrder", () => {
  it("groups lines by supplier, sorted by name, with lines that need a pick last", () => {
    const data = summarize();
    expect(data.groups.map((group) => group.supplierName)).toEqual(["Ah Huat Trading", "FreshPoultry", "KL Trading", NOT_READY_GROUP]);
    expect(data.groups[3]?.lines[0]).toMatchObject({ itemName: "taugeh", needsPick: true, lineTotalCents: null });
    expect(data.needsPickCount).toBe(1);
  });

  it("adds up subtotals and the total, leaving out lines with no known price", () => {
    const data = summarize();
    const [ahHuat, fresh, kl] = data.groups;
    expect(ahHuat?.subtotalCents).toBe(1080);
    expect(fresh?.subtotalCents).toBe(3400);
    expect(kl?.subtotalCents).toBe(13740);
    expect(kl?.unknownPriceCount).toBe(1);
    expect(data.unknownPriceCount).toBe(1);
    expect(data.totalCents).toBe(1080 + 3400 + 13740);
    expect(OrderSummaryDataSchema.safeParse(data).success).toBe(true);
  });

  it("marks weighed lines and their totals as estimates", () => {
    const data = summarize();
    expect(data.groups[1]).toMatchObject({ supplierName: "FreshPoultry", approx: true });
    expect(data.groups[1]?.lines[0]?.approx).toBe(true);
    expect(data.groups[0]?.approx).toBe(false);
    expect(data.approx).toBe(true);
  });

  it("warns when a supplier's subtotal is below its minimum order", () => {
    const data = summarize();
    expect(data.groups.map((group) => group.belowMinimum)).toEqual([true, false, false, false]);
  });

  it("carries payment terms, delivery date and skipped lines", () => {
    const data = summarize([...DEMO_LINES, line(4, { lineId: LINES[4], status: "SKIPPED", item: item("x", KL) })]);
    expect(data.groups[0]).toMatchObject({ paymentNote: "Cash on delivery", deliveryDate: "2026-11-05" });
    expect(data.groups[2]?.paymentNote).toBe("Pay within 14 days");
    expect(data.skippedCount).toBe(1);
  });

  it("recalculates totals and warnings for unsaved quantities", () => {
    const data = summarize();
    const edited = withQuantities(data, new Map([[LINES[0], 10]]));
    expect(edited.groups[0]).toMatchObject({ subtotalCents: 5400, belowMinimum: false });
    expect(edited.totalCents).toBe(data.totalCents + 8 * 540);
    expect(withQuantities(data, new Map([[LINES[4], 3]])).groups[3]?.lines[0]?.qty).toBeNull();
  });

  it("names items as the purchase order will", () => {
    expect(itemName({ brand: null, name: "Toor dal", variant: null, pack_size: "1kg" })).toBe("Toor dal 1kg");
  });
});

describe("OrderSummaryDataSchema", () => {
  it("rejects a summary whose totals do not add up", () => {
    const data = summarize();
    expect(OrderSummaryDataSchema.safeParse({ ...data, totalCents: data.totalCents + 1 }).success).toBe(false);
  });
});

describe("buildOrderSummary", () => {
  const tables = {
    shop_order: [{ id: ORDER, shop_id: SHOP, state: "AWAITING_CONFIRM", version: 3, created_at: "2026-11-03T08:00:00Z" }],
    shop_order_line: [
      {
        order_id: ORDER,
        id: LINES[0],
        position: 1,
        raw_text: "2 trays eggs",
        qty: 2,
        status: "PICKED",
        expected_price_cents: 540,
        delivery_date: null,
        shop_item: {
          order_unit: "tray",
          billing_type: "fixed",
          supplier_id: AH_HUAT,
          product: { brand: "Seng Choon", name: "Eggs", variant: "Fresh", pack_size: "tray of 30" },
        },
      },
    ],
    shop_supplier: [{ shop_id: SHOP, supplier_id: AH_HUAT, minimum_order_cents: 5000, payment_terms: "cod", supplier: { name: "Ah Huat Trading" } }],
    purchase_order: [],
  };

  it("loads the order from the database and maps its state", async () => {
    const { client } = fakeDb(tables);
    const hydrated = await buildOrderSummary({ db: client, subject: { kind: "shop_order", id: ORDER }, shopId: SHOP, now: new Date() });
    expect(hydrated).toMatchObject({ state: "awaiting_confirm", subjectVersion: 3, audience: "shop" });
    expect(hydrated.data.groups[0]).toMatchObject({ supplierName: "Ah Huat Trading", subtotalCents: 1080, belowMinimum: true });
    expect(hydrated.data.groups[0]?.lines[0]?.itemName).toBe("Seng Choon Eggs Fresh tray of 30");
  });

  it("does not find an order from another shop", async () => {
    const { client } = fakeDb(tables);
    await expect(
      buildOrderSummary({ db: client, subject: { kind: "shop_order", id: ORDER }, shopId: OTHER_SHOP, now: new Date() }),
    ).rejects.toMatchObject({ reason: "NOT_FOUND" });
    await expect(
      buildOrderSummary({ db: client, subject: { kind: "shop_order", id: ORDER }, shopId: OTHER_SHOP, now: new Date() }),
    ).rejects.toBeInstanceOf(CardError);
  });
});
