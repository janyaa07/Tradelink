import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import {
  ATTENTION_FILTERS,
  FILTER_LABELS,
  filterAttention,
  parseAttentionFilter,
  tallyAttention,
  type AttentionFilter,
} from "@/features/admin/attention";
import { AttentionQueue } from "@/features/admin/components/AttentionQueue";
import { param, type SearchParams } from "@/features/admin/params";
import { getAttentionItems } from "@/features/admin/queries/attention";
import { getOperators } from "@/features/admin/queries/people";
import { EmptyState } from "@/ui/EmptyState";
import { FilterTabs, PageHeader } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Needs attention" };

const EMPTY: Record<AttentionFilter, string> = {
  all: "Nothing needs attention right now.",
  high: "No high priority items right now.",
  medium: "No medium priority items right now.",
  unassigned: "Every item has someone on it.",
};

function attentionHref(filter: AttentionFilter): string {
  return filter === "all" ? "/admin/attention" : `/admin/attention?filter=${filter}`;
}

export default async function AttentionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const filter = parseAttentionFilter(param(await searchParams, "filter"));
  const [items, operators] = await Promise.all([getAttentionItems(), getOperators()]);
  const tally = tallyAttention(items);
  const shown = filterAttention(items, filter);
  const choices = operators.map((operator) => ({ userId: operator.userId, fullName: operator.fullName }));
  const counts: Record<AttentionFilter, number> = { all: items.length, high: tally.high, medium: tally.medium, unassigned: tally.unassigned };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Needs attention"
        description="The platform's work queue, most urgent first. Assign an item to take it, and mark it handled when it is done."
        actions={
          <FilterTabs
            label="Filter items"
            tabs={ATTENTION_FILTERS.map((tab) => ({
              href: attentionHref(tab),
              label: FILTER_LABELS[tab],
              count: counts[tab],
              current: tab === filter,
            }))}
          />
        }
      />
      {shown.length === 0 ? <EmptyState>{EMPTY[filter]}</EmptyState> : <AttentionQueue items={shown} operators={choices} />}
    </div>
  );
}
