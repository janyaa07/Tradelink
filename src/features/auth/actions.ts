"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/data/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  next: z.string().startsWith("/").optional(),
});

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
  redirect(parsed.data.next && !parsed.data.next.startsWith("//") ? parsed.data.next : "/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
