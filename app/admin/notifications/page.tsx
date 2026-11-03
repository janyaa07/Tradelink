import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { NotificationsPage, parseNotificationFilter } from "@/features/notifications/NotificationsPage";

export const metadata: Metadata = { title: "Notifications" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminNotificationsPage({ searchParams }: Props) {
  await requireRole("admin");
  const filter = parseNotificationFilter((await searchParams).filter);
  return <NotificationsPage role="admin" subtitle="Supplier invitations, disputes and security events." filter={filter} />;
}
