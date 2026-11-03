import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrgKind } from "../labels";
import { money, selectAll, selectMaybe } from "./fetch";

const orgSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["buyer", "supplier", "platform"]),
  name: z.string(),
  status: z.enum(["invited", "active", "suspended", "declined"]),
  contact_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  joined_at: z.string().nullable(),
  created_at: z.string(),
  inviter: z.object({ name: z.string() }).nullable(),
});

export type Organisation = {
  id: string;
  kind: OrgKind;
  name: string;
  status: "invited" | "active" | "suspended" | "declined";
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  joinedAt: string | null;
  createdAt: string;
  invitedBy: string | null;
};

const ORG_SELECT =
  "id, kind, name, status, contact_name, phone, email, address, joined_at, created_at, inviter:organisations!organisations_invited_by_org_id_fkey(name)";

function toOrganisation(row: z.infer<typeof orgSchema>): Organisation {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    status: row.status,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    invitedBy: row.inviter?.name ?? null,
  };
}

/** Organisations visible to the admin (RLS), by name. Optionally one kind. */
export async function getOrganisations(kind?: OrgKind): Promise<Organisation[]> {
  const supabase = await createSupabaseServerClient();
  const rows = await selectAll(orgSchema, "organisations", (from, to) => {
    const query = supabase.from("organisations").select(ORG_SELECT).order("name").range(from, to);
    return kind ? query.eq("kind", kind) : query;
  });
  return rows.map(toOrganisation);
}

export async function getOrganisation(id: string, kind: OrgKind): Promise<Organisation | null> {
  const supabase = await createSupabaseServerClient();
  const row = await selectMaybe(
    orgSchema,
    "the organisation",
    supabase.from("organisations").select(ORG_SELECT).eq("id", id).eq("kind", kind).maybeSingle(),
  );
  return row ? toOrganisation(row) : null;
}

const supplierProfileSchema = z.object({
  product_range: z.string().nullable(),
  delivery_days: z.array(z.number()),
  lead_time_days: z.number(),
  lead_time_note: z.string().nullable(),
  cutoff_time: z.string(),
  minimum_order: money,
  bank_last4: z.string().nullable(),
});

export type SupplierProfile = {
  productRange: string | null;
  deliveryDays: number[];
  leadTimeDays: number;
  leadTimeNote: string | null;
  cutoffTime: string;
  minimumOrder: string | number;
  bankLast4: string | null;
};

export async function getSupplierProfile(orgId: string): Promise<SupplierProfile | null> {
  const supabase = await createSupabaseServerClient();
  const row = await selectMaybe(
    supplierProfileSchema,
    "the supplier profile",
    supabase
      .from("supplier_profiles")
      .select("product_range, delivery_days, lead_time_days, lead_time_note, cutoff_time, minimum_order, bank_last4")
      .eq("organisation_id", orgId)
      .maybeSingle(),
  );
  if (!row) return null;
  return {
    productRange: row.product_range,
    deliveryDays: row.delivery_days,
    leadTimeDays: row.lead_time_days,
    leadTimeNote: row.lead_time_note,
    cutoffTime: row.cutoff_time,
    minimumOrder: row.minimum_order,
    bankLast4: row.bank_last4,
  };
}

export async function getTradingHours(orgId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const row = await selectMaybe(
    z.object({ trading_hours: z.string().nullable() }),
    "buyer settings",
    supabase.from("buyer_settings").select("trading_hours").eq("organisation_id", orgId).maybeSingle(),
  );
  return row?.trading_hours ?? null;
}
