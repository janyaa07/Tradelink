"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/domain/money";
import { Button } from "@/ui/Button";
import { FieldGrid, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { SettingFacts, SettingsCard } from "@/features/settings/SettingsCard";
import { updateBusinessProfileAction } from "./profileActions";
import { formatCutoff, formatDeliveryDays, formatLeadTime, WEEKDAYS } from "./profile";
import type { BusinessProfile as Profile } from "./queries";
import { useSupplierForm } from "./useSupplierForm";

function ProfileList({ profile }: { profile: Profile }) {
  return (
    <SettingFacts
      rows={[
        ["Business", profile.business],
        ["Contact person", profile.contact || "Not added yet"],
        ["Phone", profile.phone || "Not added yet"],
        ["Email", profile.email || "Not added yet"],
        ["Address", profile.address || "Not added yet"],
        ["Product range", profile.range || "Not added yet"],
        ["Delivery days", formatDeliveryDays(profile.days)],
        ["Lead time", formatLeadTime(profile.leadDays)],
        ["Minimum order", formatMoney(profile.minimum)],
        ["Order cut-off", formatCutoff(profile.cutoff)],
      ]}
    />
  );
}

function ProfileForm({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const errorId = useId();
  const { onSubmit, error, pending } = useSupplierForm(updateBusinessProfileAction, { onSuccess: onClose });
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-3 border-t border-line px-4 py-3.5 rail:px-[18px]"
    >
      <p>
        <span className="text-muted">Business</span> <b>{profile.business}</b>
      </p>
      <FieldGrid>
        <TextField label="Contact person" name="contact" defaultValue={profile.contact} autoComplete="name" maxLength={120} />
        <TextField label="Phone" name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" maxLength={20} />
        <TextField label="Email" name="email" type="email" defaultValue={profile.email} autoComplete="email" maxLength={254} />
        <TextField label="Address" name="address" defaultValue={profile.address} autoComplete="street-address" maxLength={200} />
        <TextField label="Product range" name="range" defaultValue={profile.range} maxLength={200} />
        <TextField label="Lead time (days)" name="lead" type="number" inputMode="numeric" min={0} max={14} step={1} defaultValue={profile.leadDays} />
        <TextField
          label="Order cut-off"
          hint="24-hour time, such as 16:00."
          name="cutoff"
          type="time"
          step={60}
          defaultValue={formatCutoff(profile.cutoff)}
        />
        <TextField label="Minimum order (S$)" name="minimum" type="number" inputMode="decimal" min={0} step={0.01} defaultValue={profile.minimum} />
      </FieldGrid>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[.82rem] text-muted">Delivery days</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="inline-flex min-h-6 items-center gap-1.5">
              <input
                type="checkbox"
                name="days"
                value={day.value}
                defaultChecked={profile.days.includes(day.value)}
                className="size-4 accent-accent"
              />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-[.8rem] text-muted">Changes to cut-off, delivery days and minimum order apply to new orders only.</p>
      <FormError id={errorId}>{error}</FormError>
      <div className="flex flex-wrap gap-1.5">
        <Button type="submit" variant="primary" disabled={pending}>
          Save profile
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

/** Business profile and delivery terms, as a settings card with Edit (SUP-18). */
export function BusinessProfile({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  return (
    <SettingsCard
      id="profile"
      title="Business profile"
      description="Contact details and delivery terms that buyers see."
      action={
        editing ? null : (
          <Button size="small" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        )
      }
    >
      {editing ? <ProfileForm profile={profile} onClose={() => setEditing(false)} /> : <ProfileList profile={profile} />}
    </SettingsCard>
  );
}
