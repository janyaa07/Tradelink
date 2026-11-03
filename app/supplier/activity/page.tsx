import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { ActivityFeed } from "@/features/supplier/ActivityFeed";
import { PageHead } from "@/features/supplier/PageHead";
import { getActivity } from "@/features/supplier/queries";
import { Panel } from "@/ui/Panel";

export const metadata: Metadata = { title: "Recent activity · Tradelink" };

export default async function SupplierActivityPage() {
  const session = await requireRole("supplier");
  const activity = await getActivity(session.orgId, 200);

  return (
    <>
      <PageHead title="Recent activity">
        Orders, stock updates and account events for {session.orgName}, newest first.
      </PageHead>
      <Panel>
        <ActivityFeed items={activity} />
      </Panel>
    </>
  );
}
