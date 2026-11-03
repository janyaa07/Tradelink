import type { ReactNode } from "react";
import { requireRole } from "@/data/session";
import { getDeliveriesToCheck } from "@/features/buyer/queries";
import { getTodos } from "@/features/buyer/todo-queries";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { getDraft } from "@/features/ordering/queries";
import { RoleShell } from "@/features/shell/RoleShell";

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("buyer");
  const [draft, deliveries, unread, actions] = await Promise.all([
    getDraft(session.userId),
    getDeliveriesToCheck(session.orgId),
    countUnreadNotifications(),
    getTodos(session.orgId),
  ]);
  return (
    <RoleShell
      role="buyer"
      userName={session.fullName}
      orgName={session.orgName}
      counts={{ "/buyer/orders": deliveries.length }}
      bellCount={unread + actions.length}
      cartCount={draft.lines.length}
    >
      {children}
    </RoleShell>
  );
}
