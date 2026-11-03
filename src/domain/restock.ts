/** Ready for tomorrow (DISCOVERY 6.3): usual items running out within 3 days, topped up for a week. */
export const RESTOCK_BELOW_DAYS = 3;
export const COVER_DAYS = 7;

/** Rounding guard so 7 × 0.3 (2.1000000000000005) does not round up to 3. */
const EPSILON = 1e-9;

export type RestockInput = {
  productId: string;
  inShop: number;
  usePerDay: number;
  /** Quantity on the buyer's open orders (pending, accepted or out for delivery). */
  onOrder: number;
  /** Stock the supplier can still sell; 0 for products still to be confirmed. */
  available: number;
  skippedToday: boolean;
};

export type RestockRow = {
  productId: string;
  daysLeft: number;
  /** Quantity that covers a week. */
  want: number;
  /** Quantity suggested, limited by stock available. */
  qty: number;
};

/** (in shop + on order) ÷ use per day. Items that are not used never run out. */
export function daysLeft(inShop: number, onOrder: number, usePerDay: number): number {
  if (usePerDay <= 0) return Number.POSITIVE_INFINITY;
  return (inShop + onOrder) / usePerDay;
}

/** One decimal, as shown in "{n} days left". */
export function formatDaysLeft(days: number): string {
  return Number.isFinite(days) ? days.toFixed(1) : "–";
}

export function weekQuantity(item: Pick<RestockInput, "inShop" | "usePerDay" | "onOrder">): number {
  return Math.max(1, Math.ceil(COVER_DAYS * item.usePerDay - item.inShop - item.onOrder - EPSILON));
}

/** min(max(1, ⌈7 × use − in shop − on order⌉), max(1, available)). */
export function restockQuantity(item: Pick<RestockInput, "inShop" | "usePerDay" | "onOrder" | "available">): number {
  return Math.min(weekQuantity(item), Math.max(1, item.available));
}

/** The plan, in the order the usual items were given. Empty when suggestions are off. */
export function restockPlan(items: RestockInput[], suggestReorder: boolean): RestockRow[] {
  if (!suggestReorder) return [];
  return items
    .map((item) => ({ item, left: daysLeft(item.inShop, item.onOrder, item.usePerDay) }))
    .filter(({ item, left }) => left < RESTOCK_BELOW_DAYS && !item.skippedToday)
    .map(({ item, left }) => ({
      productId: item.productId,
      daysLeft: left,
      want: weekQuantity(item),
      qty: restockQuantity(item),
    }));
}
