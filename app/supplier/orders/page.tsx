import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { getOrders } from "@/features/orders/queries";
import { IssueCard } from "@/features/supplier/IssueCard";
import { newIdempotencyKey } from "@/features/supplier/keys";
import { PageHead } from "@/features/supplier/PageHead";
import { getOpenIssues } from "@/features/supplier/queries";
import { SupplierOrderList } from "@/features/supplier/SupplierOrderList";
import { RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Incoming orders · Tradelink" };

export default async function SupplierOrdersPage() {
  const session = await requireRole("supplier");
  const [orders, issues] = await Promise.all([
    getOrders({ supplierOrgId: session.orgId, limit: 100 }),
    getOpenIssues(session.orgId),
  ]);

  return (
    <>
      <PageHead title="Incoming orders">Only orders for {session.orgName} appear here.</PageHead>
      {issues.length > 0 ? (
        <section id="problems" aria-labelledby="problems-title" className="flex scroll-mt-4 flex-col gap-2.5">
          <h2 id="problems-title">Problems to answer</h2>
          <RecordList>
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} idemKey={newIdempotencyKey()} />
            ))}
          </RecordList>
        </section>
      ) : null}
      <section id="orders" aria-labelledby="orders-title" className="flex scroll-mt-4 flex-col gap-2.5">
        <h2 id="orders-title" className={issues.length > 0 ? undefined : "sr-only"}>
          Orders
        </h2>
        <SupplierOrderList orders={orders} now={new Date()} empty="No orders yet." />
      </section>
    </>
  );
}
