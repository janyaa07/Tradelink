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
