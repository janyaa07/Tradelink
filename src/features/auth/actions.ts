"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  next: z.string().startsWith("/").optional(),
});

const ROLE_HOME: Record<string, string> = { buyer: "/buyer", supplier: "/supplier", platform: "/admin" };

export type SignInState = { error: string | null; email: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = signInSchema.safeParse({
    email,
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    const limited = error.status === 429;
    return { error: limited ? "Too many attempts. Try again in a few minutes." : "Check your email and password.", email };
  }
  if (parsed.data.next && !parsed.data.next.startsWith("//")) redirect(parsed.data.next);
  const { data: who } = await supabase.rpc("whoami");
  const kind = who && typeof who === "object" && "kind" in who ? String(who.kind) : "";
  redirect(ROLE_HOME[kind] ?? "/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
