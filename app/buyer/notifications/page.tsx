import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";

export const metadata: Metadata = { title: "Alerts · Tradelink" };

export default async function BuyerNotificationsPage() {
  await requireRole("buyer");
  return <NotificationsPage subtitle="Updates on your orders, deliveries and problems." />;
}
