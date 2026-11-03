import type { ReactNode } from "react";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { RoleShell } from "@/features/shell/RoleShell";
import { countNewOrders } from "@/features/supplier/queries";
import { needsReorder } from "@/features/supplier/stock";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("supplier");
  const [newOrders, catalogue, unread] = await Promise.all([
    countNewOrders(session.orgId),
    getCatalogue({ supplierOrgId: session.orgId }),
    countUnreadNotifications(),
  ]);

  return (
    <RoleShell
      role="supplier"
      userName={session.fullName}
      orgName={session.orgName}
      counts={{
        "/supplier/orders": newOrders,
        "/supplier/inventory": catalogue.filter(needsReorder).length,
        "/supplier/notifications": unread,
      }}
    >
      {children}
    </RoleShell>
  );
}
