import type { ReactNode } from "react";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { BellPanel } from "@/features/notifications/BellPanel";
import { countUnreadNotifications, getNotifications } from "@/features/notifications/queries";
import { RoleShell } from "@/features/shell/RoleShell";
import { getOpenDateRequests, getUnansweredMessages } from "@/features/orders/requests";
import { SupplierBellActions } from "@/features/supplier/SupplierBellActions";
import { countNewOrders, getOpenIssues } from "@/features/supplier/queries";
import { needsReorder } from "@/features/supplier/stock";

const PANEL_NOTES = 8;

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("supplier");
  const [newOrders, catalogue, unread, notes] = await Promise.all([
    countNewOrders(session.orgId),
    getCatalogue({ supplierOrgId: session.orgId }),
    countUnreadNotifications(),
    getNotifications(PANEL_NOTES),
  ]);
  const [dateRequests, messages, issues] = await Promise.all([
    getOpenDateRequests(session.orgId),
    getUnansweredMessages(session.orgId),
    getOpenIssues(session.orgId),
  ]);
  const actionCount = dateRequests.length + messages.length + (newOrders > 0 ? 1 : 0) + (issues.length > 0 ? 1 : 0);

  return (
    <RoleShell
      role="supplier"
      userName={session.fullName}
      orgName={session.orgName}
      counts={{
        "/supplier/orders": newOrders,
        "/supplier/inventory": catalogue.filter(needsReorder).length,
      }}
      bellCount={unread + dateRequests.length + messages.length}
      bellPanel={
        <BellPanel
          role="supplier"
          notes={notes}
          unread={unread}
          actions={
            actionCount > 0 ? (
              <SupplierBellActions dateRequests={dateRequests} messages={messages} newOrders={newOrders} problems={issues.length} />
            ) : undefined
          }
        />
      }
    >
      {children}
    </RoleShell>
  );
}
