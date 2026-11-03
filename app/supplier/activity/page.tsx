import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import {
  ACTIVITY_FILTER_LABELS,
  ACTIVITY_FILTERS,
  activityHref,
  activityKind,
  groupByDay,
  parseActivityFilter,
  type ActivityFilter,
} from "@/features/supplier/activity";
import { ActivityFeed } from "@/features/supplier/ActivityFeed";
import { getActivity } from "@/features/supplier/queries";
import { EmptyState } from "@/ui/EmptyState";
import { FilterTabs, PageHeader } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Activity · Tradelink" };

const LIMIT = 200;

const EMPTY: Record<ActivityFilter, string> = {
  all: "No activity yet.",
  order: "No order activity yet.",
  stock: "No stock or price changes yet.",
  account: "No account activity yet.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SupplierActivityPage({ searchParams }: Props) {
  const session = await requireRole("supplier");
  const params = await searchParams;
  const raw = params.filter;
  const filter = parseActivityFilter((Array.isArray(raw) ? raw[0] : raw) ?? "");
  const activity = await getActivity(session.orgId, LIMIT);
  const shown = filter === "all" ? activity : activity.filter((item) => activityKind(item.action) === filter);
  const days = groupByDay(shown, new Date());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Activity"
        description={`Orders, stock changes and account events at ${session.orgName}, newest first.`}
        actions={
          <FilterTabs
            label="Show activity"
            tabs={ACTIVITY_FILTERS.map((each) => ({
              href: activityHref(each),
              label: ACTIVITY_FILTER_LABELS[each],
              current: each === filter,
            }))}
          />
        }
      />
      {days.length === 0 ? <EmptyState>{EMPTY[filter]}</EmptyState> : <ActivityFeed days={days} />}
      {activity.length === LIMIT ? <p className="text-[.8rem] text-muted">Showing the latest {LIMIT} events.</p> : null}
    </div>
  );
}
