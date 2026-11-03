import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { ActionAlerts } from "@/features/buyer/ActionAlerts";
import { getTodos } from "@/features/buyer/todo-queries";
import { NotificationList } from "@/features/notifications/NotificationList";

export const metadata: Metadata = { title: "Alerts · Tradelink" };

export default async function BuyerNotificationsPage() {
  const session = await requireRole("buyer");
  const todos = await getTodos(session.orgId);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>Alerts</h1>
        <p className="text-muted">Things to settle first, then updates on your orders, deliveries and problems.</p>
      </div>
      <ActionAlerts todos={todos} />
      <NotificationList title="Updates" />
    </>
  );
}
