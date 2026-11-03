import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { OrgKind, OrgStatus } from "../labels";
import { selectAll, selectMaybe } from "./fetch";

const membershipSchema = z.object({
  user_id: z.uuid(),
  organisation: z.object({
    id: z.uuid(),
    name: z.string(),
    kind: z.enum(["buyer", "supplier", "platform"]),
    status: z.enum(["invited", "active", "suspended", "declined"]),
  }),
});

const profileSchema = z.object({
  user_id: z.uuid(),
  full_name: z.string(),
  email: z.string().nullable(),
  last_seen_at: z.string().nullable(),
});

export type Account = {
  userId: string;
  fullName: string;
  email: string | null;
  lastSeenAt: string | null;
  org: { id: string; name: string; kind: OrgKind; status: OrgStatus };
};

/**
 * Every account on the platform with its organisation (admins can read all memberships and
 * profiles). Memberships and profiles share only auth.users, so they are joined here.
 */
export async function getAccounts(kind?: OrgKind): Promise<Account[]> {
  const supabase = await createSupabaseServerClient();
  const memberships = await selectAll(membershipSchema, "accounts", (from, to) => {
    const query = supabase
      .from("memberships")
      .select("user_id, organisation:organisations!inner(id, name, kind, status)")
      .order("user_id")
      .range(from, to);
    return kind ? query.eq("organisation.kind", kind) : query;
  });
  if (memberships.length === 0) return [];

  const profiles = await selectAll(profileSchema, "profiles", (from, to) =>
    supabase.from("profiles").select("user_id, full_name, email, last_seen_at").order("user_id").range(from, to),
  );
  const byUser = new Map(profiles.map((profile) => [profile.user_id, profile]));

  return memberships
    .map((membership) => {
      const profile = byUser.get(membership.user_id);
      return {
        userId: membership.user_id,
        fullName: profile?.full_name ?? "Unknown user",
        email: profile?.email ?? null,
        lastSeenAt: profile?.last_seen_at ?? null,
        org: membership.organisation,
      };
    })
    .sort((a, b) => a.org.name.localeCompare(b.org.name) || a.fullName.localeCompare(b.fullName));
}

const adminProfileSchema = z.object({ user_id: z.uuid(), team: z.string(), shift: z.string() });

export type Operator = Account & { team: string; shift: string };

const DEFAULT_TEAM = "Order desk";
const DEFAULT_SHIFT = "Mon to Fri, 09:00 to 18:00";

/** Admins are the members of the platform organisation; team and shift come from admin_profiles. */
export async function getOperators(): Promise<Operator[]> {
  const supabase = await createSupabaseServerClient();
  const [accounts, adminProfiles] = await Promise.all([
    getAccounts("platform"),
    selectAll(adminProfileSchema, "operator profiles", (from, to) =>
      supabase.from("admin_profiles").select("user_id, team, shift").order("user_id").range(from, to),
    ),
  ]);
  const byUser = new Map(adminProfiles.map((profile) => [profile.user_id, profile]));
  return accounts
    .map((account) => ({
      ...account,
      team: byUser.get(account.userId)?.team ?? DEFAULT_TEAM,
      shift: byUser.get(account.userId)?.shift ?? DEFAULT_SHIFT,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getOperatorName(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const row = await selectMaybe(
    z.object({ full_name: z.string() }),
    "the operator",
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
  );
  return row?.full_name ?? null;
}

export async function getTeam(userId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const row = await selectMaybe(
    z.object({ team: z.string() }),
    "your team",
    supabase.from("admin_profiles").select("team").eq("user_id", userId).maybeSingle(),
  );
  return row?.team ?? DEFAULT_TEAM;
}
