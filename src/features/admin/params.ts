import { z } from "zod";
import type { OrderStatus } from "@/ui/ProgressSteps";

/** A single search param value: the first when repeated, otherwise undefined. */
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, name: string): string | undefined {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

export function isUuid(value: unknown): value is string {
  return z.uuid().safeParse(value).success;
}

/** "ORD-1044", "ord 1044" or "1044" to 1044; anything else to null. */
export function parseOrderNumber(value: string | undefined): number | null {
  const match = /^\s*(?:ord[-\s]?)?(\d{1,12})\s*$/i.exec(value ?? "");
  if (!match?.[1]) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export function parseOrderStatus(value: string | undefined): OrderStatus | null {
  return ORDER_STATUS_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

export const AUDIT_PAGE_SIZE = 30;
export type AuditOutcome = "all" | "allowed" | "denied";

export type AuditQuery = { orgId: string | null; outcome: AuditOutcome; page: number };

export function parseAuditQuery(params: SearchParams): AuditQuery {
  const org = param(params, "org");
  const outcome = param(params, "outcome");
  const page = Number(param(params, "page") ?? "1");
  return {
    orgId: isUuid(org) ? org : null,
    outcome: outcome === "allowed" || outcome === "denied" ? outcome : "all",
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** The query string for an audit page, keeping the filters. Page 1 and defaults are left out. */
export function auditHref(query: AuditQuery): string {
  const search = new URLSearchParams();
  if (query.orgId) search.set("org", query.orgId);
  if (query.outcome !== "all") search.set("outcome", query.outcome);
  if (query.page > 1) search.set("page", String(query.page));
  const text = search.toString();
  return text ? `/admin/audit?${text}` : "/admin/audit";
}

/** The status filters on the Suppliers list. */
export const ORG_STATUS_FILTERS = ["all", "active", "invited", "suspended", "declined"] as const;
export type OrgStatusFilter = (typeof ORG_STATUS_FILTERS)[number];

export function parseOrgStatusFilter(value: string | undefined): OrgStatusFilter {
  return ORG_STATUS_FILTERS.find((filter) => filter === value) ?? "all";
}

/** A typed search from ?q=, trimmed and capped. Empty when there is none. */
export function searchText(params: SearchParams): string {
  return (param(params, "q") ?? "").trim().slice(0, 60);
}

/** True when every word of the search appears in one of the fields, ignoring case. An empty search matches all. */
export function matchesSearch(search: string, fields: readonly (string | null)[]): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fields
    .filter((field): field is string => Boolean(field))
    .join(" ")
    .toLowerCase();
  return words.every((word) => text.includes(word));
}

/** A list page's query string, leaving out empty values and the default filter. */
export function listHref(path: string, query: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value && value !== "all") search.set(name, value);
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}
