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
import { HomeGreeting } from "@/features/home/HomeParts";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { formatDateTime, formatLongDate, greeting } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { Panel } from "@/ui/Panel";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Home" };

/** Admin Home: the attention queue first, then the platform's figures and recent activity (ADM-01). */
export default async function AdminHomePage() {
  const session = await requireRole("admin");
  const [items, unread, orderRows, suppliers, activity, lowStock, operators] = await Promise.all([
    getAttentionItems(),
    countUnreadNotifications(),
    getOrderStatRows(),
    getOrganisations("supplier"),
    getRecentAudit(3),
    getLowStock(3),
    getOperators(),
  ]);
  const now = new Date();
  const orders = summariseOrders(orderRows);
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
  const online = operators.filter((operator) => presenceOf(operator.lastSeenAt, now) === "Online").length;
  const high = items.filter((item) => item.priority === "high").length;
  const line =
    items.length === 0
      ? "Nothing needs attention right now."
      : `${items.length} ${items.length === 1 ? "item needs" : "items need"} attention${high > 0 ? `, ${high} of them high priority` : ""}.`;

  return (
    <>
      <HomeGreeting eyebrow={`${formatLongDate(now)} · ${session.orgName}`} title={`${greeting(now)}, ${firstName(session.fullName)}`} line={line} ai={false} />

      <Tiles
        items={[
          { label: "Need attention", value: items.length, alert: items.length > 0 },
          { label: "Open orders", value: orders.open },
          { label: "Open order value", value: formatMoney(orders.openValueCents) },
          { label: "Active suppliers", value: activeSuppliers },
        ]}
      />

      <Panel title="Needs attention" action={<LinkButton href="/admin/attention" variant="text">See all</LinkButton>}>
        {items.length === 0 ? (
          <p className="text-muted">Nothing needs attention right now.</p>
        ) : (
          <div>
            {items.slice(0, 4).map((item) => (
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

      <Columns>
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
            <MiniRow title="Operators online" sub={`${operators.length} on the team`} end={<b className="num">{online}</b>} />
            <MiniRow title="Unread alerts" sub="Invitations, disputes and security" end={<b className="num">{unread}</b>} />
          </div>
        </Panel>
      </Columns>
    </>
  );
}
