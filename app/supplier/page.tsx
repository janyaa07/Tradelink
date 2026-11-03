import type { Metadata } from "next";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { formatMoney, sumCents } from "@/domain/money";
import { getOrders, OPEN_STATUSES } from "@/features/orders/queries";
import { ActivityFeed } from "@/features/supplier/ActivityFeed";
import { buildSupplierTodos } from "@/features/supplier/issues";
import { getActivity, getOpenIssues } from "@/features/supplier/queries";
import { needsReorder } from "@/features/supplier/stock";
import { SupplierOrderList } from "@/features/supplier/SupplierOrderList";
import { greeting } from "@/ui/format";
import { HomeHero } from "@/ui/HomeHero";
import { LinkButton } from "@/ui/LinkButton";
import { Panel } from "@/ui/Panel";
import { ServiceGrid, ServiceTile } from "@/ui/ServiceGrid";
import { StatCard, StatGrid } from "@/ui/StatCard";
import { TodoItem, TodoList } from "@/ui/TodoItem";

export const metadata: Metadata = { title: "Home · Tradelink" };

export default async function SupplierHomePage() {
  const session = await requireRole("supplier");
  const [openOrders, catalogue, issues, activity] = await Promise.all([
    getOrders({ supplierOrgId: session.orgId, statuses: OPEN_STATUSES, limit: 200 }),
    getCatalogue({ supplierOrgId: session.orgId }),
    getOpenIssues(session.orgId),
    getActivity(session.orgId, 2),
  ]);
  const now = new Date();
  const pending = openOrders.filter((order) => order.status === "pending");
  const toDeliver = openOrders.filter((order) => order.status !== "pending");
  const lowStock = catalogue.filter(needsReorder);
  const todos = buildSupplierTodos(issues, catalogue);

  return (
    <HomeHero
      greeting={greeting(now)}
      firstName={session.fullName.split(" ")[0] ?? session.fullName}
      orgName={session.orgName}
      prompt="Find a product in your inventory"
      promptHref="/supplier/inventory#inventory-search"
    >
      <ServiceGrid>
        <ServiceTile href="/supplier/orders" label="Orders" icon="list" count={pending.length} />
        <ServiceTile href="/supplier/inventory" label="Inventory" icon="stock" count={lowStock.length} />
        <ServiceTile href="/supplier/inventory?add=1" label="Add product" icon="box" />
        <ServiceTile href="/supplier/orders#problems" label="Problems" icon="flag" count={issues.length} />
        <ServiceTile href="/supplier/orders#orders" label="Deliveries" icon="truck" />
        <ServiceTile href="/supplier/stock-history" label="Stock history" icon="history" />
        <ServiceTile href="/supplier/activity" label="Activity" icon="pulse" />
        <ServiceTile href="/supplier/settings" label="Settings" icon="gear" />
      </ServiceGrid>
      <StatGrid>
        <StatCard href="/supplier/orders" value={pending.length} label="New orders" alert={pending.length > 0} />
        <StatCard href="/supplier/orders#orders" value={toDeliver.length} label="To deliver" />
        <StatCard
          href="/supplier/orders#orders"
          value={formatMoney(sumCents(openOrders.map((order) => order.totalCents)))}
          label="Open order value"
        />
        <StatCard
          href="/supplier/inventory?low=1"
          value={lowStock.length}
          label="Low stock products"
          alert={lowStock.length > 0}
        />
      </StatGrid>
      <div className="grid gap-4 min-[860px]:grid-cols-2">
        <Panel title="To do">
          {todos.length === 0 ? (
            <p className="text-muted">You are all caught up.</p>
          ) : (
            <TodoList>
              {todos.map((todo) => (
                <TodoItem
                  key={todo.key}
                  tone={todo.tone}
                  title={todo.title}
                  detail={todo.detail}
                  actions={<LinkButton href={todo.href}>{todo.label}</LinkButton>}
                />
              ))}
            </TodoList>
          )}
        </Panel>
        <Panel
          title="Recent activity"
          action={
            <LinkButton href="/supplier/activity" variant="text">
              See all
            </LinkButton>
          }
        >
          <ActivityFeed items={activity} />
        </Panel>
      </div>
      <h2>New orders</h2>
      <SupplierOrderList orders={pending} now={now} empty="No new orders right now." />
    </HomeHero>
  );
}
