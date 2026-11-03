import { getSession, roleOf } from "@/data/session";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { markAllNotificationsReadAction } from "./actions";
import { NotificationItems } from "./NotificationItems";
import { getNotifications } from "./queries";

type NotificationListProps = {
  /** The section heading, such as "Updates". */
  title: string;
  /** "h1" when the list is the page, "h2" when it is embedded under another section. */
  headingLevel?: "h1" | "h2";
  subtitle?: string;
};

/** The signed-in user's notifications, newest first, with Mark all as read. Embeddable in any page. */
export async function NotificationList({ title, headingLevel = "h2", subtitle }: NotificationListProps) {
  const session = await getSession();
  const role = session ? roleOf(session.kind) : "buyer";
  const notes = await getNotifications();
  const unread = notes.filter((note) => !note.readAt).length;
  const Heading = headingLevel;
  const headingId = `notifications-${headingLevel}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading id={headingId}>{title}</Heading>
          {subtitle ? <p className="text-muted">{subtitle}</p> : null}
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit">Mark all as read</Button>
          </form>
        ) : null}
      </div>
      {notes.length === 0 ? (
        <EmptyState>No notifications yet.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          <NotificationItems notes={notes} role={role} />
        </div>
      )}
    </section>
  );
}
