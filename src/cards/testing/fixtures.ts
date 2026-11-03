import type { CardEnvelope } from "../envelope";

export const SHOP = "00000000-0000-4000-b000-000000000001";
export const OTHER_SHOP = "00000000-0000-4000-b000-000000000099";
export const THREAD = "00000000-0000-4000-f000-000000000001";
export const ORDER = "00000000-0000-4000-9000-000000000001";
export const AH_HUAT = "00000000-0000-4000-c000-000000000001";
export const KL = "00000000-0000-4000-c000-000000000002";
export const FRESH = "00000000-0000-4000-c000-000000000003";
export const LINES = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
] as const;

/** A stored card row as Postgres returns it. */
export function cardRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "00000000-0000-4000-a100-000000000001",
    type: "order_summary",
    schema_version: 1,
    audience: "shop",
    shop_id: SHOP,
    supplier_id: null,
    subject_kind: "shop_order",
    subject_id: ORDER,
    subject_version: 2,
    state: "awaiting_confirm",
    data: {},
    actions: [
      { id: "confirm", label: "Confirm order", style: "primary", enabled: true },
      { id: "edit", label: "Edit order", style: "secondary", enabled: true },
      { id: "cancel", label: "Cancel order", style: "danger", enabled: true },
    ],
    reason: null,
    question: null,
    surfaces: ["chat"],
    thread_id: THREAD,
    superseded_by: null,
    expires_at: null,
    created_at: "2026-11-03T08:00:00.000000+00:00",
    updated_at: "2026-11-03T08:00:00.000000+00:00",
    ...overrides,
  };
}

export function card(overrides: Partial<CardEnvelope> = {}): CardEnvelope {
  return {
    id: "00000000-0000-4000-a100-000000000001",
    type: "order_summary",
    schemaVersion: 1,
    audience: "shop",
    shopId: SHOP,
    supplierId: null,
    subject: { kind: "shop_order", id: ORDER, version: 2 },
    state: "awaiting_confirm",
    data: {},
    actions: [
      { id: "confirm", label: "Confirm order", style: "primary", enabled: true },
      { id: "edit", label: "Edit order", style: "secondary", enabled: true },
      { id: "cancel", label: "Cancel order", style: "danger", enabled: true },
    ],
    reason: null,
    question: null,
    surfaces: ["chat"],
    threadId: THREAD,
    supersededBy: null,
    expiresAt: null,
    createdAt: "2026-11-03T08:00:00.000000+00:00",
    updatedAt: "2026-11-03T08:00:00.000000+00:00",
    ...overrides,
  };
}
