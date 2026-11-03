import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase/server";

const sessionSchema = z.object({
  userId: z.uuid(),
  fullName: z.string(),
  email: z.string().nullable(),
  theme: z.enum(["system", "light", "dark"]),
  orgId: z.uuid(),
  orgName: z.string(),
  orgStatus: z.enum(["invited", "active", "suspended", "declined"]),
  kind: z.enum(["buyer", "supplier", "platform"]),
});

export type Session = z.infer<typeof sessionSchema>;
export type Role = "buyer" | "supplier" | "admin";

export const roleOf = (kind: Session["kind"]): Role => (kind === "platform" ? "admin" : kind);

/** The signed-in user and organisation, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("whoami");
  if (error || !data) return null;
  const parsed = sessionSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

/** Requires a signed-in member of the given role; otherwise sends them away. */
export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (roleOf(session.kind) !== role) redirect(`/${roleOf(session.kind)}`);
  return session;
}
