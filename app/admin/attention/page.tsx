import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { filterAttention, parseAttentionFilter, tallyAttention } from "@/features/admin/attention";
import { AttentionCard } from "@/features/admin/components/AttentionCard";
import { AttentionChips } from "@/features/admin/components/AttentionChips";
import { PageHead } from "@/features/admin/components/Layout";
import { param, type SearchParams } from "@/features/admin/params";
import { getAttentionItems } from "@/features/admin/queries/attention";
import { getOperators } from "@/features/admin/queries/people";
import { EmptyState } from "@/ui/EmptyState";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Needs attention" };

export default async function AttentionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const filter = parseAttentionFilter(param(await searchParams, "filter"));
  const [items, operators] = await Promise.all([getAttentionItems(), getOperators()]);
  const tally = tallyAttention(items);
  const shown = filterAttention(items, filter);
  const choices = operators.map((operator) => ({ userId: operator.userId, fullName: operator.fullName }));

  return (
    <>
      <PageHead title="Needs attention" sub="Work for the operations team, most urgent first." />
      <Tiles
        items={[
          { label: "High priority", value: tally.high, alert: tally.high > 0 },
          { label: "Medium priority", value: tally.medium },
          { label: "Assigned", value: tally.assigned },
          { label: "Unassigned", value: tally.unassigned },
        ]}
      />
      <AttentionChips current={filter} />
      {shown.length === 0 ? (
        <EmptyState>Nothing here right now.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-start gap-2.5 min-[980px]:grid-cols-2">
          {shown.map((item) => (
            <AttentionCard key={item.key} item={item} operators={choices} />
          ))}
        </div>
      )}
    </>
  );
}
