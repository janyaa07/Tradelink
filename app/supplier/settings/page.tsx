import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { signOut } from "@/features/auth/actions";
import { BusinessProfile } from "@/features/supplier/BusinessProfile";
import { PageHead } from "@/features/supplier/PageHead";
import { getBusinessProfile } from "@/features/supplier/queries";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { ThemeSetting } from "@/ui/ThemeSetting";

export const metadata: Metadata = { title: "Settings · Tradelink" };

export default async function SupplierSettingsPage() {
  const session = await requireRole("supplier");
  const profile = await getBusinessProfile(session.orgId);

  return (
    <>
      <PageHead title="Settings">Your business details and preferences.</PageHead>
      <Panel title="Appearance">
        <ThemeSetting />
      </Panel>
      <BusinessProfile profile={profile} />
      <Panel title="Account">
        <p className="text-muted">
          Signed in as {session.fullName}
          {session.email ? `, ${session.email}` : ""}.
        </p>
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </Panel>
    </>
  );
}
