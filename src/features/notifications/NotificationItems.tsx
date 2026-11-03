import Link from "next/link";
import { cx } from "@/ui/cx";
import { formatDateTime } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import type { NotificationRow } from "./queries";
import { routeFor, toneOf, type NotificationRole } from "./routes";

function ItemBody({ note }: { note: NotificationRow }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cx("mt-2 size-2 flex-none rounded-full", note.readAt ? "bg-transparent" : "bg-accent")}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <Pill tone={toneOf(note.kind)}>{note.kind}</Pill>
          <span className="text-[.8rem] text-muted">
            {formatDateTime(note.createdAt)}
            {note.readAt ? "" : " · New"}
          </span>
        </span>
        <span className="text-[.925rem] text-ink">{note.body}</span>
        <span className="text-[.8rem] font-medium text-muted">{note.title}</span>
      </span>
    </>
  );
}

/**
 * Notification rows, newest first. A row about an order, problem or product is one link to it,
 * with an arrow, so the update leads straight to what it is about.
 */
export function NotificationItems({ notes, role }: { notes: NotificationRow[]; role: NotificationRole }) {
  return (
    <ul className="flex flex-col">
      {notes.map((note) => (
        <li key={note.id} className={cx("border-b border-line last:border-b-0", !note.readAt && "bg-accent-soft/40")}>
          {note.link ? (
            <Link
              href={routeFor(role, note.link)}
              className="flex min-w-0 items-start gap-3 px-3.5 py-3 no-underline transition-colors duration-150 hover:bg-sunken"
            >
              <ItemBody note={note} />
              <span className="self-center text-muted">
                <Icon name="arrow" size={18} />
                <span className="sr-only">Open</span>
              </span>
            </Link>
          ) : (
            <div className="flex min-w-0 items-start gap-3 px-3.5 py-3">
              <ItemBody note={note} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
