/** A delivered order, reduced to what the on-time record needs. Dates are Singapore calendar dates. */
export type Delivery = { supplierId: string; dueDate: string | null; deliveredOn: string | null };

export type SupplierRecord = {
  supplierId: string;
  name: string;
  delivered: number;
  onTime: number;
  /** Whole percent of delivered orders delivered on or before the due date (BUY-40.2). */
  percent: number;
};

/**
 * On-time record for each given supplier with at least one delivered order that has a due date
 * and a delivery date. Deliveries for suppliers not in the list are ignored.
 */
export function supplierRecords(suppliers: { id: string; name: string }[], deliveries: Delivery[]): SupplierRecord[] {
  const counts = new Map<string, { delivered: number; onTime: number }>();
  for (const delivery of deliveries) {
    if (!delivery.dueDate || !delivery.deliveredOn) continue;
    const count = counts.get(delivery.supplierId) ?? { delivered: 0, onTime: 0 };
    count.delivered += 1;
    if (delivery.deliveredOn <= delivery.dueDate) count.onTime += 1;
    counts.set(delivery.supplierId, count);
  }
  return suppliers.flatMap((supplier) => {
    const count = counts.get(supplier.id);
    if (!count) return [];
    return [
      {
        supplierId: supplier.id,
        name: supplier.name,
        delivered: count.delivered,
        onTime: count.onTime,
        percent: Math.round((count.onTime / count.delivered) * 100),
      },
    ];
  });
}

/** Highest on-time percent; ties go to more deliveries, then name. */
export function bestRecord(records: SupplierRecord[]): SupplierRecord | null {
  const ranked = [...records].sort(
    (a, b) => b.percent - a.percent || b.delivered - a.delivered || a.name.localeCompare(b.name),
  );
  return ranked[0] ?? null;
}
