import { toCents, type Cents } from "@/domain/money";
import type { OrderStatus } from "@/ui/ProgressSteps";

export type OrderStatRow = {
  status: OrderStatus;
  buyerOrgId: string;
  supplierOrgId: string;
  lines: { qty: number; unitPrice: string | number }[];
};

export type OrderStats = {
  orders: number;
  open: number;
  /** Excludes rejected and cancelled orders, as the prototype's spend(). */
  valueCents: Cents;
  openValueCents: Cents;
};

const OPEN = new Set<OrderStatus>(["pending", "accepted", "out_for_delivery"]);
const NOT_COUNTED = new Set<OrderStatus>(["rejected", "cancelled"]);

export const EMPTY_STATS: OrderStats = { orders: 0, open: 0, valueCents: 0, openValueCents: 0 };

export function orderTotalCents(lines: OrderStatRow["lines"]): Cents {
  return lines.reduce((total, line) => total + toCents(line.unitPrice) * line.qty, 0);
}

function add(stats: OrderStats, row: OrderStatRow, total: Cents): OrderStats {
  const open = OPEN.has(row.status);
  return {
    orders: stats.orders + 1,
    open: stats.open + (open ? 1 : 0),
    valueCents: stats.valueCents + (NOT_COUNTED.has(row.status) ? 0 : total),
    openValueCents: stats.openValueCents + (open ? total : 0),
  };
}

export function summariseOrders(rows: readonly OrderStatRow[]): OrderStats {
  return rows.reduce((stats, row) => add(stats, row, orderTotalCents(row.lines)), EMPTY_STATS);
}

/** Stats per organisation: each order counts for its buyer and its supplier. */
export function statsByOrg(rows: readonly OrderStatRow[]): Map<string, OrderStats> {
  const byOrg = new Map<string, OrderStats>();
  for (const row of rows) {
    const total = orderTotalCents(row.lines);
    for (const orgId of [row.buyerOrgId, row.supplierOrgId]) {
      byOrg.set(orgId, add(byOrg.get(orgId) ?? EMPTY_STATS, row, total));
    }
  }
  return byOrg;
}
