import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { ActionAlerts } from "@/features/buyer/ActionAlerts";
import { getTodos } from "@/features/buyer/todo-queries";
import { MarkAllReadButton, NotificationCard } from "@/features/notifications/NotificationList";
import { getNotifications } from "@/features/notifications/queries";
import { FilterTabs, PageHeader } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Alerts · Tradelink" };

const FILTERS = ["all", "action", "updates"] as const;
type AlertFilter = (typeof FILTERS)[number];

const LABELS: Record<AlertFilter, string> = { all: "All", action: "Needs action", updates: "Updates" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function parseFilter(value: string | string[] | undefined): AlertFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return FILTERS.find((filter) => filter === raw) ?? "all";
}

function hrefFor(filter: AlertFilter): string {
  return filter === "all" ? "/buyer/notifications" : `/buyer/notifications?filter=${filter}`;
}

export default async function BuyerNotificationsPage({ searchParams }: Props) {
  const session = await requireRole("buyer");
  const filter = parseFilter((await searchParams).filter);
  const [todos, notes] = await Promise.all([getTodos(session.orgId), getNotifications()]);
  const unread = notes.some((note) => !note.readAt);
  const counts: Record<AlertFilter, number> = { all: todos.length + notes.length, action: todos.length, updates: notes.length };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
      <PageHeader
        title="Alerts"
        description="Things to act on first, then updates on your orders, deliveries and problems."
        actions={unread ? <MarkAllReadButton /> : null}
      />
      <FilterTabs
        label="Show alerts"
        tabs={FILTERS.map((tab) => ({ href: hrefFor(tab), label: LABELS[tab], count: counts[tab], current: tab === filter }))}
      />
      {filter !== "updates" ? <ActionAlerts todos={todos} /> : null}
      {filter !== "action" ? (
        <NotificationCard title="Updates" notes={notes} role="buyer" empty="No updates yet. Changes to your orders show here." />
      ) : null}
    </div>
  );
}
