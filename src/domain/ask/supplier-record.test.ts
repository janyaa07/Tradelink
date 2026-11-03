import { describe, expect, it } from "vitest";
import { bestRecord, supplierRecords, type Delivery } from "./supplier-record";

const suppliers = [
  { id: "harbour", name: "Harbour Dry Goods" },
  { id: "fresh", name: "Fresh Lane Produce" },
  { id: "bright", name: "Bright Pantry Supplies" },
];

function delivery(supplierId: string, dueDate: string | null, deliveredOn: string | null): Delivery {
  return { supplierId, dueDate, deliveredOn };
}

describe("supplierRecords (BUY-40.2)", () => {
  it("counts deliveries on or before the due date as on time", () => {
    const records = supplierRecords(suppliers, [
      delivery("harbour", "2026-11-02", "2026-11-02"),
      delivery("harbour", "2026-11-03", "2026-11-01"),
      delivery("harbour", "2026-11-04", "2026-11-05"),
      delivery("fresh", "2026-11-02", "2026-11-02"),
    ]);
    expect(records).toEqual([
      { supplierId: "harbour", name: "Harbour Dry Goods", delivered: 3, onTime: 2, percent: 67 },
      { supplierId: "fresh", name: "Fresh Lane Produce", delivered: 1, onTime: 1, percent: 100 },
    ]);
  });

  it("skips deliveries without a due date or delivery date", () => {
    expect(supplierRecords(suppliers, [delivery("harbour", null, "2026-11-02"), delivery("fresh", "2026-11-02", null)])).toEqual([]);
  });

  it("ignores deliveries from suppliers that are not connected and active", () => {
    expect(supplierRecords(suppliers, [delivery("someone-else", "2026-11-02", "2026-11-02")])).toEqual([]);
  });
});

describe("bestRecord", () => {
  it("picks the highest percent, then more deliveries, then name", () => {
    const records = supplierRecords(suppliers, [
      delivery("harbour", "2026-11-02", "2026-11-02"),
      delivery("fresh", "2026-11-02", "2026-11-02"),
      delivery("fresh", "2026-11-03", "2026-11-03"),
      delivery("bright", "2026-11-02", "2026-11-05"),
    ]);
    expect(bestRecord(records)?.name).toBe("Fresh Lane Produce");
  });

  it("is null when nothing has been delivered", () => {
    expect(bestRecord([])).toBeNull();
  });
});
