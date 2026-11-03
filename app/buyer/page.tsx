import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney, toCents } from "@/domain/money";
import { ArrivingPanel } from "@/features/buyer/ArrivingPanel";
import { MyUsualTile } from "@/features/buyer/MyUsualTile";
import { getBuyerSettings, getDeliveriesToCheck, getWeekSpendCents } from "@/features/buyer/queries";
import { ReadyPanel } from "@/features/buyer/ReadyPanel";
import { getRestockPlan } from "@/features/buyer/restock-plan";
import { getTodos } from "@/features/buyer/todo-queries";
import { greeting } from "@/ui/format";
import { HomeHero } from "@/ui/HomeHero";
import { ServiceGrid, ServiceTile } from "@/ui/ServiceGrid";
import { StatCard, StatGrid } from "@/ui/StatCard";

export const metadata: Metadata = { title: "Home · Tradelink" };

export default async function BuyerHomePage() {
  const session = await requireRole("buyer");
  const [todos, plan, deliveries, spentCents, settings] = await Promise.all([
    getTodos(session.orgId),
    getRestockPlan(session.orgId),
    getDeliveriesToCheck(session.orgId),
    getWeekSpendCents(session.orgId),
    getBuyerSettings(session.orgId),
  ]);
  const budgetCents = toCents(settings.weeklyBudget);
  const firstName = session.fullName.split(" ")[0] ?? session.fullName;

  return (
    <HomeHero
      greeting={greeting(new Date())}
      firstName={firstName}
      orgName={session.orgName}
      prompt="What do you need to order?"
      promptHref="/buyer/assistant"
      promptIcon="chat"
    >
      <ServiceGrid columns={6}>
        <ServiceTile label="Assistant" icon="chat" href="/buyer/assistant" />
        <MyUsualTile />
        <ServiceTile label="Products" icon="box" href="/buyer/products" />
        <ServiceTile label="Orders" icon="list" href="/buyer/orders" />
        <ServiceTile label="Insights" icon="trend" href="/buyer/insights" />
        <ServiceTile label="Settings" icon="gear" href="/buyer/settings" />
      </ServiceGrid>
      <StatGrid>
        <StatCard href="/buyer/insights" value={formatMoney(spentCents)} label="Spent this week" />
        <StatCard
          href="/buyer/insights"
          value={formatMoney(Math.max(0, budgetCents - spentCents))}
          label="Left of budget"
          alert={spentCents > budgetCents}
        />
        <StatCard href="/buyer/orders?filter=to_check" value={deliveries.length} label="Deliveries to check" />
        <StatCard href="/buyer/notifications" value={todos.length} label="Alerts" alert={todos.length > 0} />
      </StatGrid>
      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 @min-[760px]:grid-cols-2">
          <ReadyPanel plan={plan} />
          <ArrivingPanel deliveries={deliveries} />
        </div>
      </div>
    </HomeHero>
  );
}
