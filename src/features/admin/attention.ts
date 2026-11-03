import type { IconName } from "@/ui/Icon";

export type Priority = "high" | "medium";

/** One row of `v_attention` (docs/RPC_CONTRACT.md, DISCOVERY 6.6). */
export type AttentionItem = {
  key: string;
  priority: Priority;
  type: string;
  title: string;
  detail: string;
  orgId: string | null;
  createdAt: string;
  assignedUserId: string | null;
};

export const ATTENTION_FILTERS = ["all", "high", "medium", "unassigned"] as const;
export type AttentionFilter = (typeof ATTENTION_FILTERS)[number];

export const FILTER_LABELS: Record<AttentionFilter, string> = {
  all: "All",
  high: "High",
  medium: "Medium",
  unassigned: "Unassigned",
};

export function parseAttentionFilter(value: unknown): AttentionFilter {
  return ATTENTION_FILTERS.find((filter) => filter === value) ?? "all";
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1 };

/** High before medium; within a priority, oldest first (ADM-02). Returns a new array. */
export function sortAttention<T extends Pick<AttentionItem, "priority" | "createdAt" | "key">>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.key.localeCompare(b.key),
  );
}

export function filterAttention<T extends Pick<AttentionItem, "priority" | "assignedUserId">>(
  items: readonly T[],
  filter: AttentionFilter,
): T[] {
  if (filter === "all") return [...items];
  if (filter === "unassigned") return items.filter((item) => !item.assignedUserId);
  return items.filter((item) => item.priority === filter);
}

export type AttentionTally = { high: number; medium: number; assigned: number; unassigned: number };

export function tallyAttention(items: readonly Pick<AttentionItem, "priority" | "assignedUserId">[]): AttentionTally {
  const high = items.filter((item) => item.priority === "high").length;
  const assigned = items.filter((item) => item.assignedUserId).length;
  return { high, medium: items.length - high, assigned, unassigned: items.length - assigned };
}

/** How many live items each operator has, keyed by user id (ADM-04, ADM-16). */
export function assignedCounts(items: readonly Pick<AttentionItem, "assignedUserId">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.assignedUserId) counts.set(item.assignedUserId, (counts.get(item.assignedUserId) ?? 0) + 1);
  }
  return counts;
}

/** The rule an item came from, read from its key prefix ("dispute:<issue id>"). */
export type AttentionSource = { rule: string; id: string };

export function sourceOf(key: string): AttentionSource {
  const split = key.indexOf(":");
  return split < 0 ? { rule: key, id: "" } : { rule: key.slice(0, split), id: key.slice(split + 1) };
}

/** System and blocked-action items can be marked handled (ADM-05). */
export function canMarkHandled(item: Pick<AttentionItem, "key" | "type">): boolean {
  return item.type === "System" || sourceOf(item.key).rule === "audit";
}

export function isDispute(item: Pick<AttentionItem, "key">): boolean {
  return sourceOf(item.key).rule === "dispute";
}

const TYPE_ICONS: Record<string, IconName> = {
  "Supplier invitation": "users",
  System: "pulse",
  Order: "list",
  Stock: "stock",
  Catalogue: "box",
  Security: "shield",
  Dispute: "flag",
  "Delivery problem": "truck",
};

export function attentionIcon(type: string): IconName {
  return TYPE_ICONS[type] ?? "flag";
}

export function priorityLabel(priority: Priority): string {
  return priority === "high" ? "High" : "Medium";
}
