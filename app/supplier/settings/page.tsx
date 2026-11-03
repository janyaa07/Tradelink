import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AccountCard, AppearanceCard, SettingsLayout, type SettingsNavGroup } from "@/features/settings/SettingsParts";
import { BusinessProfile } from "@/features/supplier/BusinessProfile";
import { getBusinessProfile } from "@/features/supplier/queries";

export const metadata: Metadata = { title: "Settings · Tradelink" };

const NAV: SettingsNavGroup[] = [
  { label: "Business", items: [{ id: "profile", label: "Business profile" }] },
  {
    label: "You",
    items: [
      { id: "account", label: "Account" },
      { id: "appearance", label: "Appearance" },
    ],
  },
];

export default async function SupplierSettingsPage() {
  const session = await requireRole("supplier");
  const profile = await getBusinessProfile(session.orgId);

  return (
    <SettingsLayout description={`${session.orgName} · ${session.fullName}`} nav={NAV}>
      <BusinessProfile profile={profile} />
      <AccountCard
        orgName={session.orgName}
        fullName={session.fullName}
        rows={[
          ["Name", session.fullName],
          ["Email", session.email ?? "Not given"],
          ["Business", session.orgName],
          ["Role", "Supplier"],
        ]}
      />
      <AppearanceCard />
    </SettingsLayout>
  );
}
