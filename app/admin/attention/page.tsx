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
import { getOperators, isOperationsLead } from "@/features/admin/queries/people";
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

/** Everything for the operations lead; for other operators, what the lead assigned them (the view filters it). */
export default async function AttentionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireRole("admin");
  const asked = parseAttentionFilter(param(await searchParams, "filter"));
  const [items, operators, lead] = await Promise.all([getAttentionItems(), getOperators(), isOperationsLead(session.userId)]);
  // Everything an operator sees is assigned to them, so "Unassigned" is only for the lead.
  const filters: readonly AttentionFilter[] = lead ? ATTENTION_FILTERS : ATTENTION_FILTERS.filter((tab) => tab !== "unassigned");
  const filter = filters.includes(asked) ? asked : "all";
  const tally = tallyAttention(items);
  const shown = filterAttention(items, filter);
  const choices = operators.map((operator) => ({ userId: operator.userId, fullName: operator.fullName }));
  const counts: Record<AttentionFilter, number> = { all: items.length, high: tally.high, medium: tally.medium, unassigned: tally.unassigned };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Needs attention"
        description={
          lead
            ? "The platform's work queue, most urgent first. Assign each item to an operator, and mark it handled when it is done."
            : "The items assigned to you, most urgent first. Mark each one handled when it is done."
        }
        actions={
          <FilterTabs
            label="Filter items"
            tabs={filters.map((tab) => ({
              href: attentionHref(tab),
              label: FILTER_LABELS[tab],
              count: counts[tab],
              current: tab === filter,
            }))}
          />
        }
      />
      {shown.length === 0 ? (
        <EmptyState>{lead || filter !== "all" ? EMPTY[filter] : "Nothing is assigned to you right now."}</EmptyState>
      ) : (
        <AttentionQueue items={shown} operators={choices} canAssign={lead} />
      )}
    </div>
  );
}
