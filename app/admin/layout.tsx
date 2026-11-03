import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireRole } from "@/data/session";
import { PresencePing } from "@/features/admin/components/PresencePing";
import { countAttention } from "@/features/admin/queries/attention";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { RoleShell } from "@/features/shell/RoleShell";

export const metadata: Metadata = {
  title: { template: "%s · Tradelink admin", default: "Tradelink admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("admin");
  const [attention, unread] = await Promise.all([countAttention(), countUnreadNotifications()]);

  return (
    <RoleShell
      role="admin"
      userName={session.fullName}
      orgName={session.orgName}
      counts={{ "/admin/attention": attention, "/admin/notifications": unread }}
      bellCount={unread}
    >
      <PresencePing />
      {children}
    </RoleShell>
  );
}
