import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { PageHead, ProfileList } from "@/features/admin/components/Layout";
import { getTeam } from "@/features/admin/queries/people";
import { signOut } from "@/features/auth/actions";
import { TwoFactorPanel } from "@/features/auth/TwoFactorPanel";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { ThemeSetting } from "@/ui/ThemeSetting";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const session = await requireRole("admin");
  const team = await getTeam(session.userId);

  return (
    <>
      <PageHead title="Settings" sub="Your account and preferences." />
      <Panel title="Appearance">
        <ThemeSetting />
      </Panel>
      <Panel title="Account">
        <ProfileList
          rows={[
            ["Name", session.fullName],
            ["Team", team],
            ["Role", "Admin"],
            ["Email", session.email ?? "Not given"],
          ]}
        />
      </Panel>
      <TwoFactorPanel />
      <form action={signOut}>
        <Button type="submit">Sign out</Button>
      </form>
    </>
  );
}
