import type { ReactNode } from "react";
import { Button } from "@/ui/Button";
import { markAllNotificationsReadAction } from "./actions";
import { NotificationItems } from "./NotificationItems";
import type { NotificationRow } from "./queries";
import type { NotificationRole } from "./routes";

/** Mark all as read, for a page header. */
export function MarkAllReadButton() {
  return (
    <form action={markAllNotificationsReadAction}>
      <Button type="submit">Mark all as read</Button>
    </form>
  );
}

type NotificationCardProps = {
  /** The card's heading, such as "Updates". */
  title: string;
  notes: NotificationRow[];
  role: NotificationRole;
  /** Shown when there are no rows. */
  empty: ReactNode;
};

/** Notifications in one card with its heading, newest first. */
export function NotificationCard({ title, notes, role, empty }: NotificationCardProps) {
  const unread = notes.filter((note) => !note.readAt).length;
  const headingId = `notifications-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={headingId}>{title}</h2>
        {unread > 0 ? <span className="text-[.8rem] text-muted">{unread} new</span> : null}
      </div>
      {notes.length > 0 ? <NotificationItems notes={notes} role={role} /> : <p className="px-4 py-4 text-[.875rem] text-muted">{empty}</p>}
    </section>
  );
}
