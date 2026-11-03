"use server";

import { requireRole } from "@/data/session";
import { runRpc, type FormResult } from "./respond";
import { formValues, parseInput, profileSchema } from "./validation";

/** Saves the business profile (SUP-18). Cut-off, delivery days and minimum order apply to new orders only. */
export async function updateBusinessProfileAction(form: FormData): Promise<FormResult> {
  await requireRole("supplier");
  const values = formValues(form, ["contact", "phone", "email", "address", "range", "lead", "cutoff", "minimum"]);
  const days = form.getAll("days").filter((value): value is string => typeof value === "string");
  const input = parseInput(profileSchema, { ...values, days });
  if (!input.ok) return input;
  const profile = input.data;
  return runRpc(
    "update_business_profile",
    {
      p_contact: profile.contact,
      p_phone: profile.phone,
      p_email: profile.email,
      p_address: profile.address,
      p_range: profile.range,
      p_days: profile.days,
      p_lead: profile.lead,
      p_cutoff: profile.cutoff,
      p_minimum: profile.minimum,
    },
    () => "Business profile saved.",
  );
}
