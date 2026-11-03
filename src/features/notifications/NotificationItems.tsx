import Link from "next/link";
import { cx } from "@/ui/cx";
import { formatDateTime } from "@/ui/format";
import type { NotificationRow } from "./queries";
import { routeFor, toneOf, type NotificationRole } from "./routes";

const TONE_TEXT = { good: "text-good", bad: "text-bad", info: "text-info", warn: "text-warn", plain: "text-muted" } as const;

function ItemBody({ note }: { note: NotificationRow }) {
  const unread = !note.readAt;
  return (
    <>
      <span aria-hidden="true" className={cx("mt-[7px] size-[7px] flex-none rounded-full", unread ? "bg-info" : "bg-transparent")} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx("text-[.875rem]", unread ? "font-semibold text-ink" : "text-ink/80")}>
          {note.title}
          {unread ? <span className="sr-only"> (new)</span> : null}
        </span>
        <span className="text-[.8rem] text-muted">{note.body}</span>
        <span className="text-[.75rem] text-muted">
          <span className={cx("font-semibold", TONE_TEXT[toneOf(note.kind)])}>{note.kind}</span>
          <span aria-hidden="true"> · </span>
          {formatDateTime(note.createdAt)}
        </span>
      </span>
    </>
  );
}

/**
 * Notification rows, newest first, like an inbox: a dot for unread, the title, what happened and when.
 * A row about an order, problem or product opens it.
 */
export function NotificationItems({ notes, role }: { notes: NotificationRow[]; role: NotificationRole }) {
  return (
    <ul className="flex flex-col">
      {notes.map((note) => (
        <li key={note.id} className="border-t border-line first:border-t-0">
          {note.link ? (
            <Link
              href={routeFor(role, note.link)}
              className="flex min-w-0 items-start gap-3 px-4 py-3 no-underline transition-colors duration-150 hover:bg-sunken/60"
            >
              <ItemBody note={note} />
              <span className="flex-none self-center text-[.8rem] font-semibold text-accent">Open</span>
            </Link>
          ) : (
            <div className="flex min-w-0 items-start gap-3 px-4 py-3">
              <ItemBody note={note} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
