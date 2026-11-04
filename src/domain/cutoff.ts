import { singaporeClockOf, weekdayName } from "./singapore-time";

/** A supplier's delivery terms, from supplier_profiles. */
export type DeliveryTerms = {
  /** "16:00" or "16:00:00", Singapore time. */
  cutoffTime: string;
  /** ISO weekdays the supplier delivers on: 1 = Monday to 7 = Sunday (0 is read as Sunday). */
  deliveryDays: number[];
  leadTimeDays: number;
  /** The supplier's minimum order as "40.00"; absent or "0.00" means none (BUY-24). */
  minimumOrder?: string;
};

export const DEFAULT_TERMS: DeliveryTerms = { cutoffTime: "16:00", deliveryDays: [1, 2, 3, 4, 5, 6], leadTimeDays: 1 };

export type EarliestDelivery = {
  pastCutoff: boolean;
  /** Days from today to the earliest delivery day. */
  daysAhead: number;
  isoWeekday: number;
};

function minutesOf(time: string): number {
  const [hours = "16", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function deliveryDaySet(days: number[]): Set<number> {
  const set = new Set(days.map((day) => (day === 0 ? 7 : day)).filter((day) => day >= 1 && day <= 7));
  return set.size > 0 ? set : new Set([1, 2, 3, 4, 5, 6, 7]);
}

/** The first delivery day an order placed now can make, from cut-off, lead time and delivery days. */
export function earliestDelivery(terms: DeliveryTerms, now: Date): EarliestDelivery {
  const clock = singaporeClockOf(now);
  const pastCutoff = clock.minutes >= minutesOf(terms.cutoffTime);
  const days = deliveryDaySet(terms.deliveryDays);
  const first = Math.max(1, terms.leadTimeDays) + (pastCutoff ? 1 : 0);
  for (let ahead = first; ahead < first + 7; ahead += 1) {
    const isoWeekday = ((clock.isoWeekday - 1 + ahead) % 7) + 1;
    if (days.has(isoWeekday)) return { pastCutoff, daysAhead: ahead, isoWeekday };
  }
  return { pastCutoff, daysAhead: first, isoWeekday: ((clock.isoWeekday - 1 + first) % 7) + 1 };
}

/** "Order by 16:00 for tomorrow", or "Past cut-off, earliest delivery is Thursday" (BUY-08, BUY-20). */
export function cutoffText(terms: DeliveryTerms, now: Date): string {
  const earliest = earliestDelivery(terms, now);
  const day = earliest.daysAhead === 1 ? "tomorrow" : weekdayName(earliest.isoWeekday);
  if (earliest.pastCutoff) return `Past cut-off, earliest delivery is ${day}`;
  const time = terms.cutoffTime.slice(0, 5);
  return earliest.daysAhead === 1 ? `Order by ${time} for tomorrow` : `Order by ${time} for delivery on ${day}`;
}
