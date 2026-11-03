import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney, toCents } from "@/domain/money";
import { BuyerOrderCard } from "@/features/buyer/BuyerOrderCard";
import { MyUsualTile } from "@/features/buyer/MyUsualTile";
import { getBuyerSettings, getDeliveriesToCheck, getWeekSpendCents } from "@/features/buyer/queries";
import { ReadyPanel } from "@/features/buyer/ReadyPanel";
import { getRestockPlan } from "@/features/buyer/restock-plan";
import { getTodos } from "@/features/buyer/todo-queries";
import { TodoPanel } from "@/features/buyer/TodoPanel";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { greeting } from "@/ui/format";
import { HomeHero } from "@/ui/HomeHero";
import { RecordList } from "@/ui/RecordCard";
import { ServiceGrid, ServiceTile } from "@/ui/ServiceGrid";
import { StatCard, StatGrid } from "@/ui/StatCard";

export const metadata: Metadata = { title: "Home · Tradelink" };

export default async function BuyerHomePage() {
  const session = await requireRole("buyer");
  const [todos, plan, deliveries, spentCents, settings, unread] = await Promise.all([
    getTodos(session.orgId),
    getRestockPlan(session.orgId),
    getDeliveriesToCheck(session.orgId),
    getWeekSpendCents(session.orgId),
    getBuyerSettings(session.orgId),
    countUnreadNotifications(),
  ]);
  const budgetCents = toCents(settings.weeklyBudget);
  const firstName = session.fullName.split(" ")[0] ?? session.fullName;

  return (
    <HomeHero
      greeting={greeting(new Date())}
      firstName={firstName}
      orgName={session.orgName}
      prompt="What do you need to order?"
      promptHref="/buyer/order"
    >
      <ServiceGrid>
        <MyUsualTile />
        <ServiceTile label="New order" icon="order" href="/buyer/order" />
        <ServiceTile label="Track" icon="truck" href="/buyer/orders" count={deliveries.length} />
        <ServiceTile label="Availability" icon="stock" href="/buyer/availability" />
        <ServiceTile label="Alerts" icon="bell" href="/buyer/notifications" count={unread} />
        <ServiceTile label="Settings" icon="gear" href="/buyer/settings" />
      </ServiceGrid>
      <StatGrid>
        <StatCard href="/buyer/orders" value={formatMoney(spentCents)} label="Spent this week" />
        <StatCard
          href="/buyer/settings"
          value={formatMoney(Math.max(0, budgetCents - spentCents))}
          label="Left of budget"
          alert={spentCents > budgetCents}
        />
        <StatCard href="/buyer/orders" value={deliveries.length} label="Deliveries to check" />
        <StatCard href="#todo" value={todos.length} label="Things to do" alert={todos.length > 0} />
      </StatGrid>
      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 @min-[860px]:grid-cols-2">
          <TodoPanel todos={todos} />
          <ReadyPanel plan={plan} />
        </div>
      </div>
      {deliveries.length > 0 ? (
        <section aria-labelledby="arriving-title" className="flex flex-col gap-2.5">
          <h2 id="arriving-title">Arriving and to check</h2>
          <RecordList>
            {deliveries.map((order) => (
              <BuyerOrderCard key={order.id} order={order} />
            ))}
          </RecordList>
        </section>
      ) : null}
    </HomeHero>
  );
}
