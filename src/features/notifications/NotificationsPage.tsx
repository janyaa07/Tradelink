import { NotificationList } from "./NotificationList";

/** The notifications page shared by the supplier and admin roles (SH-09, ADM-08). */
export function NotificationsPage({ subtitle }: { subtitle: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[1060px] flex-col gap-4">
      <NotificationList title="Notifications" headingLevel="h1" subtitle={subtitle} />
    </div>
  );
}
