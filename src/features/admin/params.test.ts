import { describe, expect, it } from "vitest";
import { deliveryDaysLabel, firstName, issueTypeLabel, timeLabel } from "./labels";
import {
  auditHref,
  isUuid,
  listHref,
  matchesSearch,
  param,
  parseAuditQuery,
  parseOrderNumber,
  parseOrderStatus,
  parseOrgStatusFilter,
  searchText,
} from "./params";

const ORG = "3f2b8c1e-5d4a-4b7c-9e8f-1a2b3c4d5e6f";

describe("parseOrderNumber", () => {
  it("reads order numbers with or without the prefix", () => {
    expect(parseOrderNumber("ORD-1044")).toBe(1044);
    expect(parseOrderNumber(" ord 1044 ")).toBe(1044);
    expect(parseOrderNumber("1044")).toBe(1044);
  });

  it("rejects anything else", () => {
    expect(parseOrderNumber("")).toBeNull();
    expect(parseOrderNumber(undefined)).toBeNull();
    expect(parseOrderNumber("ORD-")).toBeNull();
    expect(parseOrderNumber("1044; drop")).toBeNull();
    expect(parseOrderNumber("0")).toBeNull();
  });
});

describe("parseOrderStatus", () => {
  it("accepts known statuses only", () => {
    expect(parseOrderStatus("out_for_delivery")).toBe("out_for_delivery");
    expect(parseOrderStatus("lost")).toBeNull();
    expect(parseOrderStatus(undefined)).toBeNull();
  });
});

describe("parseAuditQuery", () => {
  it("reads filters and the page", () => {
    expect(parseAuditQuery({ org: ORG, outcome: "denied", page: "3" })).toEqual({ orgId: ORG, outcome: "denied", page: 3 });
  });

  it("ignores values it cannot trust", () => {
    expect(parseAuditQuery({ org: "x),actor_org_id.neq.(", outcome: "maybe", page: "-2" })).toEqual({
      orgId: null,
      outcome: "all",
      page: 1,
    });
    expect(parseAuditQuery({ page: "1.5" }).page).toBe(1);
  });

  it("uses the first of repeated values", () => {
    expect(param({ outcome: ["allowed", "denied"] }, "outcome")).toBe("allowed");
  });
});

describe("auditHref", () => {
  it("keeps filters and leaves out defaults", () => {
    expect(auditHref({ orgId: null, outcome: "all", page: 1 })).toBe("/admin/audit");
    expect(auditHref({ orgId: ORG, outcome: "allowed", page: 2 })).toBe(`/admin/audit?org=${ORG}&outcome=allowed&page=2`);
  });
});

describe("list filters", () => {
  it("reads the supplier status filter", () => {
    expect(parseOrgStatusFilter("suspended")).toBe("suspended");
    expect(parseOrgStatusFilter("deleted")).toBe("all");
    expect(parseOrgStatusFilter(undefined)).toBe("all");
  });

  it("trims and caps the search", () => {
    expect(searchText({ q: "  Harbour  " })).toBe("Harbour");
    expect(searchText({ q: "x".repeat(80) })).toHaveLength(60);
    expect(searchText({})).toBe("");
  });

  it("matches every word in any field, ignoring case", () => {
    expect(matchesSearch("", ["Anything"])).toBe(true);
    expect(matchesSearch("harbour wei", ["Harbour Dry Goods", "Wei Ling Tan", null])).toBe(true);
    expect(matchesSearch("harbour ravi", ["Harbour Dry Goods", "Wei Ling Tan"])).toBe(false);
  });

  it("builds list links without defaults", () => {
    expect(listHref("/admin/suppliers", { status: "all", selected: null })).toBe("/admin/suppliers");
    expect(listHref("/admin/suppliers", { status: "active", selected: ORG })).toBe(`/admin/suppliers?status=active&selected=${ORG}`);
  });
});

describe("isUuid", () => {
  it("accepts uuids only", () => {
    expect(isUuid(ORG)).toBe(true);
    expect(isUuid("supplier-1")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("labels", () => {
  it("names delivery days in week order", () => {
    expect(deliveryDaysLabel([6, 1, 2])).toBe("Mon, Tue, Sat");
    expect(deliveryDaysLabel([])).toBe("None set");
  });

  it("formats times and names", () => {
    expect(timeLabel("16:00:00")).toBe("16:00");
    expect(firstName("  Priya Raman ")).toBe("Priya");
    expect(issueTypeLabel("wrong_item")).toBe("Wrong item");
  });
});
