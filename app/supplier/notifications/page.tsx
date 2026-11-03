import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";

export const metadata: Metadata = { title: "Notifications · Tradelink" };

export default async function SupplierNotificationsPage() {
  await requireRole("supplier");
  return <NotificationsPage subtitle="New orders, problems from buyers and account events." />;
}
