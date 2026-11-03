import Link from "next/link";
import type { Todo } from "@/domain/todos";
import { markAllNotificationsReadAction } from "@/features/notifications/actions";
import { NotificationItems } from "@/features/notifications/NotificationItems";
import type { NotificationRow } from "@/features/notifications/queries";
import { ActionAlertRows } from "./ActionAlerts";

const sectionTitleClass = "bg-sunken px-3.5 py-1.5 text-[.75rem] font-semibold uppercase tracking-[.04em] text-muted";

type AlertsPanelProps = {
  todos: Todo[];
  /** The latest notifications. */
  notes: NotificationRow[];
  unread: number;
};

/** The bell's pop-up: alerts that need action, then the latest updates, each leading to its order. */
export function AlertsPanel({ todos, notes, unread }: AlertsPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <p className="text-[1.02rem] font-semibold">Alerts</p>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="rounded-md border-0 bg-transparent px-2 py-1 text-[.85rem] font-semibold text-accent hover:bg-sunken">
              Mark all as read
            </button>
          </form>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {todos.length > 0 ? (
          <section aria-label="Needs your action">
            <p className={sectionTitleClass}>Needs your action</p>
            <ActionAlertRows todos={todos} />
          </section>
        ) : null}
        <section aria-label="Updates">
          <p className={sectionTitleClass}>Updates</p>
          {notes.length > 0 ? (
            <NotificationItems notes={notes} role="buyer" />
          ) : (
            <p className="px-3.5 py-4 text-[.9rem] text-muted">No updates yet.</p>
          )}
        </section>
      </div>
      <Link
        href="/buyer/notifications"
        className="border-t border-line px-3.5 py-2.5 text-center text-[.9rem] font-semibold text-accent no-underline hover:bg-sunken"
      >
        See all alerts
      </Link>
    </>
  );
}
