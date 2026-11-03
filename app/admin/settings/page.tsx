import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { getTeam } from "@/features/admin/queries/people";
import { AccountCard, AppearanceCard, SettingsLayout, type SettingsNavGroup } from "@/features/settings/SettingsParts";

export const metadata: Metadata = { title: "Settings" };

const NAV: SettingsNavGroup[] = [
  {
    label: "You",
    items: [
      { id: "account", label: "Account" },
      { id: "appearance", label: "Appearance" },
    ],
  },
];

export default async function AdminSettingsPage() {
  const session = await requireRole("admin");
  const team = await getTeam(session.userId);

  return (
    <SettingsLayout description={`${team} · ${session.fullName}`} nav={NAV}>
      <AccountCard
        orgName={session.orgName}
        fullName={session.fullName}
        rows={[
          ["Name", session.fullName],
          ["Team", team],
          ["Role", "Admin"],
          ["Email", session.email ?? "Not given"],
        ]}
      />
      <AppearanceCard />
    </SettingsLayout>
  );
}
