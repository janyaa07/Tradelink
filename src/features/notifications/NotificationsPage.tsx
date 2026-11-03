import { FilterTabs, PageHeader } from "@/ui/PageHeader";
import { MarkAllReadButton, NotificationCard } from "./NotificationList";
import { getNotifications } from "./queries";
import type { NotificationRole } from "./routes";

export type NotificationFilter = "all" | "unread";

export function parseNotificationFilter(value: string | string[] | undefined): NotificationFilter {
  return (Array.isArray(value) ? value[0] : value) === "unread" ? "unread" : "all";
}

type Props = {
  role: Exclude<NotificationRole, "buyer">;
  subtitle: string;
  filter: NotificationFilter;
};

/** The notifications page shared by the supplier and admin roles, as an inbox with All and Unread (SH-09, ADM-08). */
export async function NotificationsPage({ role, subtitle, filter }: Props) {
  const notes = await getNotifications();
  const unread = notes.filter((note) => !note.readAt);
  const base = `/${role}/notifications`;

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
      <PageHeader title="Notifications" description={subtitle} actions={unread.length > 0 ? <MarkAllReadButton /> : null} />
      <FilterTabs
        label="Show notifications"
        tabs={[
          { href: base, label: "All", count: notes.length, current: filter === "all" },
          { href: `${base}?filter=unread`, label: "Unread", count: unread.length, current: filter === "unread" },
        ]}
      />
      <NotificationCard
        title={filter === "unread" ? "Unread" : "All notifications"}
        notes={filter === "unread" ? unread : notes}
        role={role}
        empty={filter === "unread" ? "Nothing unread. You are all caught up." : "No notifications yet."}
      />
    </div>
  );
}
