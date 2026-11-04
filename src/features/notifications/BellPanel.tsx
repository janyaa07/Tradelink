import Link from "next/link";
import type { ReactNode } from "react";
import { markAllNotificationsReadAction } from "./actions";
import { NotificationItems } from "./NotificationItems";
import type { NotificationRow } from "./queries";
import type { NotificationRole } from "./routes";

type BellPanelProps = {
  role: Exclude<NotificationRole, "buyer">;
  /** The latest notifications. */
  notes: NotificationRow[];
  unread: number;
  /** Things to act on first, such as a buyer's new delivery date; shown above the updates when there are any. */
  actions?: ReactNode;
};

const sectionTitleClass = "bg-sunken px-3.5 py-1.5 text-[.75rem] font-semibold uppercase tracking-[.04em] text-muted";

/** The bell's pop-up for suppliers and admins: what needs them, then the latest updates. Buyers use AlertsPanel. */
export function BellPanel({ role, notes, unread, actions }: BellPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <p className="text-[1.02rem] font-semibold">Notifications</p>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="rounded-md border-0 bg-transparent px-2 py-1 text-[.85rem] font-semibold text-accent hover:bg-sunken">
              Mark all as read
            </button>
          </form>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {actions ? (
          <section aria-label="Needs your action">
            <p className={sectionTitleClass}>Needs your action</p>
            {actions}
          </section>
        ) : null}
        <section aria-label="Updates">
          {actions ? <p className={sectionTitleClass}>Updates</p> : null}
          {notes.length > 0 ? (
            <NotificationItems notes={notes} role={role} />
          ) : (
            <p className="px-3.5 py-4 text-[.9rem] text-muted">No notifications yet.</p>
          )}
        </section>
      </div>
      <Link
        href={`/${role}/notifications`}
        className="border-t border-line px-3.5 py-2.5 text-center text-[.9rem] font-semibold text-accent no-underline hover:bg-sunken"
      >
        See all notifications
      </Link>
    </>
  );
}
