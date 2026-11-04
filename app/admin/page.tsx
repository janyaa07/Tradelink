import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { AttentionIcon } from "@/features/admin/components/AttentionQueue";
import { firstName } from "@/features/admin/labels";
import { summariseOrders } from "@/features/admin/orderStats";
import { presenceOf } from "@/features/admin/presence";
import { getAttentionItems } from "@/features/admin/queries/attention";
import { getRecentAudit } from "@/features/admin/queries/audit";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { getOperators, isOperationsLead } from "@/features/admin/queries/people";
import { getLowStock } from "@/features/admin/queries/stock";
import { GlanceTabs } from "@/features/home/GlanceTabs";
import { GlanceRow, HomeGreeting } from "@/features/home/HomeParts";
import { AllClear, NextUp, type NextStep } from "@/features/home/NextUp";
import { formatDateTime, formatLongDate, greeting } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Home" };

/** Home previews the queue; the rest waits on the Attention page. */
const HOME_STEPS = 4;

/** Admin Home, laid out like the buyer's and supplier's: one next item from the attention queue, the figures, then the rest at a glance (ADM-01). */
export default async function AdminHomePage() {
  const session = await requireRole("admin");
  const [items, orderRows, suppliers, activity, lowStock, operators, lead] = await Promise.all([
    getAttentionItems(),
    getOrderStatRows(),
    getOrganisations("supplier"),
    getRecentAudit(5),
    getLowStock(5),
    getOperators(),
    isOperationsLead(session.userId),
  ]);
  const now = new Date();
  const orders = summariseOrders(orderRows);
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
  const online = operators.filter((operator) => presenceOf(operator.lastSeenAt, now) === "Online");
  const high = items.filter((item) => item.priority === "high").length;
  // The lead sees the whole queue; other operators see only what is assigned to them (v_attention).
  const urgent = high > 0 ? `, ${high} of them high priority` : "";
  const line = lead
    ? items.length === 0
      ? "Nothing needs attention right now. Everything on the platform is on track."
      : `${items.length} ${items.length === 1 ? "item needs" : "items need"} attention${urgent}.`
    : items.length === 0
      ? "Nothing is assigned to you right now."
      : `${items.length} ${items.length === 1 ? "item is" : "items are"} assigned to you${urgent}.`;

  // Most urgent first, and within a priority the newest, so Home shows what just came in.
  const preview = [...items]
    .sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high") || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, HOME_STEPS);
  const steps: NextStep[] = preview.map((item) => ({
    key: item.key,
    title: item.title,
    summary: item.type,
    tone: item.priority === "high" ? "bad" : "warn",
    detail: (
      <span className="flex items-start gap-2.5">
        <AttentionIcon item={item} size="small" />
        <span>
          {item.detail}{" "}
          <span className="text-muted">
            · {item.type}, since {formatDateTime(item.createdAt)}
          </span>
        </span>
      </span>
    ),
    actions: (
      <LinkButton href="/admin/attention" variant="primary">
        Open the queue
      </LinkButton>
    ),
  }));

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <HomeGreeting eyebrow={`${formatLongDate(now)} · ${session.orgName}`} title={`${greeting(now)}, ${firstName(session.fullName)}`} line={line} />

      {steps.length > 0 ? (
        <NextUp
          steps={steps}
          more={items.length > steps.length ? { href: "/admin/attention", label: `See all ${items.length} in Attention` } : undefined}
        />
      ) : (
        <AllClear
          text={
            lead
              ? "Nothing needs attention. Disputes, security alerts and invitations show here when they come in."
              : "Nothing is assigned to you. Items the operations lead gives you show here."
          }
        />
      )}

      <Tiles
        items={[
          { label: "Open orders", value: orders.open },
          { label: "Open order value", value: formatMoney(orders.openValueCents) },
          { label: "Active suppliers", value: activeSuppliers },
          { label: "Operators online", value: `${online.length} of ${operators.length}` },
        ]}
      />

      <GlanceTabs
        tabs={[
          {
            id: "activity",
            label: "Activity",
            count: activity.length,
            content:
              activity.length === 0 ? (
                <p className="py-3 text-muted">No activity yet.</p>
              ) : (
                activity.map((entry) => (
                  <GlanceRow
                    key={entry.id}
                    href="/admin/audit"
                    title={entry.action}
                    detail={`${entry.who} · ${formatDateTime(entry.at)}`}
                    end={entry.outcome === "denied" ? <Pill tone="bad">Blocked</Pill> : null}
                  />
                ))
              ),
          },
          {
            id: "stock",
            label: "Low stock",
            count: lowStock.total,
            content:
              lowStock.items.length === 0 ? (
                <p className="py-3 text-muted">All products are above their reorder level.</p>
              ) : (
                lowStock.items.map((product) => (
                  <GlanceRow
                    key={product.id}
                    href="/admin/suppliers/low-stock"
                    lead={<ProductArt kind={product.art} size={30} />}
                    title={product.name}
                    detail={product.supplierName}
                    end={product.health === "out" ? <Pill tone="bad">Out of stock</Pill> : <Pill tone="warn">Low stock</Pill>}
                  />
                ))
              ),
          },
          {
            id: "team",
            label: "Team online",
            count: online.length,
            content:
              online.length === 0 ? (
                <p className="py-3 text-muted">Nobody on the team is online.</p>
              ) : (
                online.map((operator) => <GlanceRow key={operator.userId} href="/admin/operators" title={operator.fullName} detail={operator.team} />)
              ),
          },
        ]}
      />
    </div>
  );
}
