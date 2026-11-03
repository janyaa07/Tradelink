import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { NotificationsPage, parseNotificationFilter } from "@/features/notifications/NotificationsPage";

export const metadata: Metadata = { title: "Notifications · Tradelink" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SupplierNotificationsPage({ searchParams }: Props) {
  await requireRole("supplier");
  const filter = parseNotificationFilter((await searchParams).filter);
  return <NotificationsPage role="supplier" subtitle="New orders, problems from buyers and account events." filter={filter} />;
}
