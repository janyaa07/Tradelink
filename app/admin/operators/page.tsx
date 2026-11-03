import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { assignedCounts } from "@/features/admin/attention";
import { PageHead } from "@/features/admin/components/Layout";
import { presenceOf, PRESENCE_TONE } from "@/features/admin/presence";
import { getAttentionItems } from "@/features/admin/queries/attention";
import { getOperators } from "@/features/admin/queries/people";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { EmptyState } from "@/ui/EmptyState";
import { Pill } from "@/ui/Pill";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Operators" };

export default async function OperatorsPage() {
  await requireRole("admin");
  const [operators, items] = await Promise.all([getOperators(), getAttentionItems()]);
  const assigned = assignedCounts(items);
  const now = new Date();

  return (
    <>
      <PageHead title="Operators" sub="The Tradelink team who handle approvals, orders and support." />
      {operators.length === 0 ? (
        <EmptyState>No operators yet.</EmptyState>
      ) : (
        <RecordList>
          {operators.map((operator) => {
            const presence = presenceOf(operator.lastSeenAt, now);
            return (
              <RecordCard
                key={operator.userId}
                lead={<BusinessLogo name={operator.fullName} seedKey={operator.userId} size={36} />}
                title={operator.fullName}
                sub={operator.team}
                pill={<Pill tone={PRESENCE_TONE[presence]}>{presence}</Pill>}
                metrics={[
                  { label: "Shift", value: operator.shift },
                  { label: "Assigned items", value: assigned.get(operator.userId) ?? 0 },
                ]}
              />
            );
          })}
        </RecordList>
      )}
    </>
  );
}
