import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  await requireRole("admin");
  return <NotificationsPage subtitle="Supplier invitations, disputes and security events." />;
}
