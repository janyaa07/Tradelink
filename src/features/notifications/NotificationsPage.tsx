import Link from "next/link";
import { getSession, roleOf, type Role } from "@/data/session";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { markAllNotificationsReadAction } from "./actions";
import { getNotifications } from "./queries";

const BAD_KINDS = new Set(["Dispute opened", "Bank details changed", "Invitation declined", "Order rejected", "Supplier suspended"]);
const GOOD_KINDS = new Set(["Invitation accepted", "Order delivered", "Order accepted"]);

function toneOf(kind: string) {
  if (BAD_KINDS.has(kind)) return "bad" as const;
  if (GOOD_KINDS.has(kind)) return "good" as const;
  return "info" as const;
}

/**
 * Database notifications carry role-neutral links such as /orders/{id}; map them to the
 * signed-in role's routes.
 */
function routeFor(role: Role, link: string): string {
  const [, section, id] = link.split("/");
  if (section === "orders" || section === "issues") return `/${role}/orders`;
  if (section === "inventory") return role === "supplier" ? "/supplier/inventory" : `/${role}`;
  if (section === "suppliers" && id) return role === "admin" ? `/admin/suppliers/${id}` : `/${role}`;
  return `/${role}`;
}

/** The notifications page shared by every role (SH-09, ADM-08). */
export async function NotificationsPage({ subtitle }: { subtitle: string }) {
  const session = await getSession();
  const role = session ? roleOf(session.kind) : "buyer";
  const notes = await getNotifications();
  const unread = notes.filter((note) => !note.readAt).length;
  return (
    <div className="mx-auto flex max-w-[1060px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em]">Notifications</h1>
          <p className="text-muted">{subtitle}</p>
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
        <ul className="flex flex-col gap-2.5">
          {notes.map((note) => (
            <li
              key={note.id}
              className={`flex flex-col gap-2 rounded-lg border bg-surface p-3.5 shadow-card ${note.readAt ? "border-line" : "border-accent"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Pill tone={toneOf(note.kind)}>{note.kind}</Pill>
                <span className="text-[0.84rem] text-muted">
                  {formatDateTime(note.createdAt)}
                  {note.readAt ? "" : " · New"}
                </span>
              </div>
              <p>{note.body}</p>
              {note.link ? (
                <Link href={routeFor(role, note.link)} className="self-start font-bold text-accent">
                  {note.title}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
