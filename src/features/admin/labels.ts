import type { PillTone } from "@/ui/Pill";

export type OrgStatus = "invited" | "active" | "suspended" | "declined";
export type OrgKind = "buyer" | "supplier" | "platform";

export const ORG_STATUS: Record<OrgStatus, { label: string; tone: PillTone }> = {
  active: { label: "Active", tone: "good" },
  invited: { label: "Invitation sent", tone: "info" },
  suspended: { label: "Suspended", tone: "bad" },
  declined: { label: "Declined", tone: "plain" },
};

export const ROLE_LABEL: Record<OrgKind, string> = { buyer: "Buyer", supplier: "Supplier", platform: "Admin" };

/** What each role can reach (ADM-13), in the prototype's words. */
export const ROLE_ACCESS: Record<OrgKind, string> = {
  buyer: "Own orders, availability",
  supplier: "Own orders and inventory",
  platform: "All records, read only on orders",
};

const ISSUE_TYPES: Record<string, string> = {
  short: "Short",
  damaged: "Damaged",
  wrong_item: "Wrong item",
  expired: "Expired",
  late: "Late",
  invoice: "Invoice",
};

export function issueTypeLabel(type: string): string {
  return ISSUE_TYPES[type] ?? type;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Postgres day numbers (0 Sunday to 6 Saturday) as "Mon, Tue, Wed". */
export function deliveryDaysLabel(days: readonly number[]): string {
  const names = [...days].sort((a, b) => a - b).map((day) => WEEKDAYS[day]).filter(Boolean);
  return names.length ? names.join(", ") : "None set";
}

/** "16:00:00" to "16:00". */
export function timeLabel(value: string): string {
  return value.slice(0, 5);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
