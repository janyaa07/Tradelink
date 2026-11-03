import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { AttentionIcon, PriorityPill } from "@/features/admin/components/AttentionCard";
import { Columns, MiniRow } from "@/features/admin/components/Layout";
import { firstName } from "@/features/admin/labels";
import { summariseOrders } from "@/features/admin/orderStats";
import { presenceOf } from "@/features/admin/presence";
import { getAttentionItems } from "@/features/admin/queries/attention";
import { getRecentAudit } from "@/features/admin/queries/audit";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { getOperators } from "@/features/admin/queries/people";
import { getLowStock } from "@/features/admin/queries/stock";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { formatDateTime, greeting } from "@/ui/format";
import { HomeHero } from "@/ui/HomeHero";
import { LinkButton } from "@/ui/LinkButton";
import { Panel } from "@/ui/Panel";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { ServiceGrid, ServiceTile } from "@/ui/ServiceGrid";
import { StatCard, StatGrid } from "@/ui/StatCard";

export const metadata: Metadata = { title: "Home" };

export default async function AdminHomePage() {
  const session = await requireRole("admin");
  const [items, unread, orderRows, suppliers, activity, lowStock, operators] = await Promise.all([
    getAttentionItems(),
    countUnreadNotifications(),
    getOrderStatRows(),
    getOrganisations("supplier"),
    getRecentAudit(2),
    getLowStock(2),
    getOperators(),
  ]);
  const now = new Date();
  const orders = summariseOrders(orderRows);
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
  const online = operators.filter((operator) => presenceOf(operator.lastSeenAt, now) === "Online").length;

  return (
    <HomeHero
      greeting={greeting(now)}
      firstName={firstName(session.fullName)}
      orgName={session.orgName}
      prompt="Find a supplier"
      promptHref="/admin/suppliers"
    >
      <ServiceGrid>
        <ServiceTile href="/admin/attention" label="Attention" icon="flag" count={items.length} />
        <ServiceTile href="/admin/notifications" label="Alerts" icon="bell" count={unread} />
        <ServiceTile href="/admin/orders" label="Orders" icon="list" />
        <ServiceTile href="/admin/suppliers" label="Suppliers" icon="crate" />
        <ServiceTile href="/admin/users" label="Users" icon="users" />
        <ServiceTile href="/admin/operators" label="Operators" icon="headset" />
        <ServiceTile href="/admin/settings" label="Settings" icon="gear" />
        <ServiceTile href="/admin/audit" label="Audit log" icon="shield" />
      </ServiceGrid>

      <StatGrid>
        <StatCard href="/admin/attention" value={items.length} label="Need attention" alert={items.length > 0} />
        <StatCard href="/admin/orders" value={orders.open} label="Open orders" />
        <StatCard href="/admin/orders" value={formatMoney(orders.openValueCents)} label="Open order value" />
        <StatCard href="/admin/suppliers" value={activeSuppliers} label="Active suppliers" />
      </StatGrid>

      <Columns>
        <Panel title="Needs attention" action={<LinkButton href="/admin/attention" variant="text">See all</LinkButton>}>
          {items.length === 0 ? (
            <p className="text-muted">Nothing needs attention right now.</p>
          ) : (
            <div>
              {items.slice(0, 2).map((item) => (
                <MiniRow
                  key={item.key}
                  lead={<AttentionIcon item={item} size="small" />}
                  title={item.title}
                  sub={item.type}
                  end={<PriorityPill priority={item.priority} />}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent activity" action={<LinkButton href="/admin/audit" variant="text">See all</LinkButton>}>
          {activity.length === 0 ? (
            <p className="text-muted">No activity yet.</p>
          ) : (
            <div>
              {activity.map((entry) => (
                <MiniRow
                  key={entry.id}
                  title={entry.action}
                  sub={`${entry.who} · ${formatDateTime(entry.at)}`}
                  end={entry.outcome === "denied" ? <Pill tone="bad">Blocked</Pill> : null}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Low stock"
          action={
            <LinkButton href="/admin/suppliers/low-stock" variant="text">
              See all {lowStock.total}
            </LinkButton>
          }
        >
          {lowStock.items.length === 0 ? (
            <p className="text-muted">All products are above their reorder level.</p>
          ) : (
            <div>
              {lowStock.items.map((product) => (
                <MiniRow
                  key={product.id}
                  lead={<ProductArt kind={product.art} size={34} />}
                  title={product.name}
                  sub={product.supplierName}
                  end={product.health === "out" ? <Pill tone="bad">Out of stock</Pill> : <Pill tone="warn">Low stock</Pill>}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Platform" action={<LinkButton href="/admin/operators" variant="text">Operators</LinkButton>}>
          <div>
            <MiniRow
              title="Operators online"
              sub={`${operators.length} on the team`}
              end={<b className="num">{online}</b>}
            />
            <MiniRow
              title="Unread alerts"
              sub="Invitations, disputes and security"
              end={<b className="num">{unread}</b>}
            />
          </div>
        </Panel>
      </Columns>
    </HomeHero>
  );
}
