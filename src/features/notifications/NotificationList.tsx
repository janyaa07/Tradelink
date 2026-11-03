import Link from "next/link";
import { getSession, roleOf } from "@/data/session";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { markAllNotificationsReadAction } from "./actions";
import { getNotifications } from "./queries";
import { routeFor, toneOf } from "./routes";

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
        <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          {notes.map((note) => (
            <li
              key={note.id}
              className={cx(
                "flex min-w-0 gap-3 border-b border-line px-3.5 py-3 last:border-b-0",
                !note.readAt && "bg-accent-soft/40",
              )}
            >
              <span
                aria-hidden="true"
                className={cx("mt-2 size-2 flex-none rounded-full", note.readAt ? "bg-transparent" : "bg-accent")}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Pill tone={toneOf(note.kind)}>{note.kind}</Pill>
                  <span className="text-[.8rem] text-muted">
                    {formatDateTime(note.createdAt)}
                    {note.readAt ? "" : " · New"}
                  </span>
                </div>
                <p className="text-[.925rem]">{note.body}</p>
                {note.link ? (
                  <Link href={routeFor(role, note.link)} className="self-start text-[.875rem] font-semibold text-accent">
                    {note.title}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
