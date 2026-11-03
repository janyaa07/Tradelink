import { describe, expect, it } from "vitest";
import {
  assignedCounts,
  attentionIcon,
  canMarkHandled,
  filterAttention,
  isDispute,
  parseAttentionFilter,
  sortAttention,
  sourceOf,
  tallyAttention,
  type AttentionItem,
} from "./attention";

const OPERATOR_A = "11111111-1111-4111-8111-111111111111";
const OPERATOR_B = "22222222-2222-4222-8222-222222222222";

function item(overrides: Partial<AttentionItem>): AttentionItem {
  return {
    key: "order:1",
    priority: "medium",
    type: "Order",
    title: "ORD-1044 waiting for Harbour Dry Goods",
    detail: "Mei's Noodle House placed it more than 30 minutes ago.",
    orgId: null,
    createdAt: "2026-11-03T08:00:00Z",
    assignedUserId: null,
    ...overrides,
  };
}

const ITEMS = [
  item({ key: "order:a", priority: "medium", createdAt: "2026-11-03T07:00:00Z", assignedUserId: OPERATOR_A }),
  item({ key: "dispute:b", priority: "high", type: "Dispute", createdAt: "2026-11-03T09:00:00Z" }),
  item({ key: "stock-low:c", priority: "medium", type: "Stock", createdAt: "2026-11-03T06:00:00Z" }),
  item({ key: "stock-out:d", priority: "high", type: "Stock", createdAt: "2026-11-03T05:00:00Z", assignedUserId: OPERATOR_B }),
  item({ key: "audit:e", priority: "medium", type: "Security", createdAt: "2026-11-03T08:00:00Z", assignedUserId: OPERATOR_A }),
];

describe("sortAttention", () => {
  it("puts high before medium, oldest first within a priority", () => {
    expect(sortAttention(ITEMS).map((i) => i.key)).toEqual(["stock-out:d", "dispute:b", "stock-low:c", "order:a", "audit:e"]);
  });

  it("does not change the input", () => {
    const before = ITEMS.map((i) => i.key);
    sortAttention(ITEMS);
    expect(ITEMS.map((i) => i.key)).toEqual(before);
  });

  it("breaks ties on the key so the order is stable", () => {
    const same = [item({ key: "b:1" }), item({ key: "a:1" })];
    expect(sortAttention(same).map((i) => i.key)).toEqual(["a:1", "b:1"]);
  });
});

describe("filterAttention", () => {
  it("keeps everything for All", () => {
    expect(filterAttention(ITEMS, "all")).toHaveLength(5);
  });

  it("filters by priority", () => {
    expect(filterAttention(ITEMS, "high").map((i) => i.key)).toEqual(["dispute:b", "stock-out:d"]);
    expect(filterAttention(ITEMS, "medium")).toHaveLength(3);
  });

  it("keeps only unassigned items for Unassigned", () => {
    expect(filterAttention(ITEMS, "unassigned").map((i) => i.key)).toEqual(["dispute:b", "stock-low:c"]);
  });
});

describe("tallyAttention", () => {
  it("counts the four tiles", () => {
    expect(tallyAttention(ITEMS)).toEqual({ high: 2, medium: 3, assigned: 3, unassigned: 2 });
  });

  it("is all zero when empty", () => {
    expect(tallyAttention([])).toEqual({ high: 0, medium: 0, assigned: 0, unassigned: 0 });
  });
});

describe("assignedCounts", () => {
  it("counts items per operator", () => {
    const counts = assignedCounts(ITEMS);
    expect(counts.get(OPERATOR_A)).toBe(2);
    expect(counts.get(OPERATOR_B)).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe("parseAttentionFilter", () => {
  it("accepts the four filters", () => {
    expect(parseAttentionFilter("high")).toBe("high");
    expect(parseAttentionFilter("unassigned")).toBe("unassigned");
  });

  it("falls back to all", () => {
    expect(parseAttentionFilter("urgent")).toBe("all");
    expect(parseAttentionFilter(undefined)).toBe("all");
    expect(parseAttentionFilter(["high"])).toBe("all");
  });
});

describe("item rules", () => {
  it("reads the rule and id from the key", () => {
    expect(sourceOf("dispute:9f0c")).toEqual({ rule: "dispute", id: "9f0c" });
    expect(sourceOf("stock-out:abc")).toEqual({ rule: "stock-out", id: "abc" });
    expect(sourceOf("plain")).toEqual({ rule: "plain", id: "" });
  });

  it("allows Mark handled only for blocked actions and system items", () => {
    expect(canMarkHandled(item({ key: "audit:42", type: "Security" }))).toBe(true);
    expect(canMarkHandled(item({ key: "svc:api", type: "System" }))).toBe(true);
    expect(canMarkHandled(item({ key: "dispute:1", type: "Dispute" }))).toBe(false);
    expect(canMarkHandled(item({ key: "stock-out:1", type: "Stock" }))).toBe(false);
  });

  it("recognises disputes", () => {
    expect(isDispute(item({ key: "dispute:1" }))).toBe(true);
    expect(isDispute(item({ key: "issue:1" }))).toBe(false);
  });

  it("maps each type to its icon, with a fallback", () => {
    expect(attentionIcon("Delivery problem")).toBe("truck");
    expect(attentionIcon("Security")).toBe("shield");
    expect(attentionIcon("Something new")).toBe("flag");
  });
});
