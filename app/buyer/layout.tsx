import type { ReactNode } from "react";
import { requireRole } from "@/data/session";
import { AlertsPanel } from "@/features/buyer/AlertsPanel";
import { getDeliveriesToCheck } from "@/features/buyer/queries";
import { getTodos } from "@/features/buyer/todo-queries";
import { countUnreadNotifications, getNotifications } from "@/features/notifications/queries";
import { getDraft } from "@/features/ordering/queries";
import { RoleShell } from "@/features/shell/RoleShell";

const PANEL_NOTES = 8;

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("buyer");
  const [draft, deliveries, unread, actions, notes] = await Promise.all([
    getDraft(session.userId),
    getDeliveriesToCheck(session.orgId),
    countUnreadNotifications(),
    getTodos(session.orgId),
    getNotifications(PANEL_NOTES),
  ]);
  return (
    <RoleShell
      role="buyer"
      userName={session.fullName}
      orgName={session.orgName}
      counts={{ "/buyer/orders": deliveries.length }}
      bellCount={unread + actions.length}
      cartCount={draft.lines.length}
      bellPanel={<AlertsPanel todos={actions} notes={notes} unread={unread} />}
    >
      {children}
    </RoleShell>
  );
}
