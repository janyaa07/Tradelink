import type { ReactNode } from "react";
import { requireRole } from "@/data/session";
import { getDeliveriesToCheck } from "@/features/buyer/queries";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { getCartSummary } from "@/features/ordering/queries";
import { RoleShell } from "@/features/shell/RoleShell";

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("buyer");
  const [cart, deliveries, unread] = await Promise.all([
    getCartSummary(session.userId),
    getDeliveriesToCheck(session.orgId),
    countUnreadNotifications(),
  ]);
  return (
    <RoleShell
      role="buyer"
      userName={session.fullName}
      orgName={session.orgName}
      counts={{ "/buyer/orders": deliveries.length, "/buyer/notifications": unread }}
      cart={cart}
    >
      {children}
    </RoleShell>
  );
}
