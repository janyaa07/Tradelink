import type { Metadata } from "next";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { plural } from "@/domain/catalogue";
import { briefingLine, customerPulse, minutesToCutoff, pickList, usualDay, type Pulse } from "@/domain/home";
import { formatMoney } from "@/domain/money";
import { singaporeDateOf } from "@/domain/singapore-time";
import { GlanceTabs } from "@/features/home/GlanceTabs";
import { AskBar, CompareBar, CutoffRing, GlanceRow, HomeGreeting, LevelBar, StepRow, type StepTone } from "@/features/home/HomeParts";
import { AllClear, NextUp } from "@/features/home/NextUp";
import { SendOutStepActions } from "@/features/home/StepActions";
import { getOrders, OPEN_STATUSES, type OrderView } from "@/features/orders/queries";
import { getBusinessProfile, getOpenIssues } from "@/features/supplier/queries";
import { inventoryHref, needsReorder } from "@/features/supplier/stock";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { formatDate, formatLongDate, greeting, orderNumber } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";

export const metadata: Metadata = { title: "Home · Tradelink" };

/** subject: a short noun phrase for the briefing line, such as "today's 3 orders to pack". */
type Step = { key: string; title: string; subject: string; detail: string; href: string; tone: StepTone } & (
  | { kind: "accept"; orders: OrderView[] }
  | { kind: "pack"; orders: OrderView[] }
  | { kind: "other" }
);

const deliveryDate = (order: OrderView) => order.confirmedDeliveryDate ?? order.requestedDeliveryDate ?? "";

function pulseText(pulse: Pulse): { text: string; tone: string } {
  if (pulse.kind === "quiet") return { text: `${pulse.daysSince} days since their last order, usually ${pulse.usualGap}`, tone: "text-warn" };
  if (pulse.kind === "growing") return { text: "Ordering more than last month", tone: "text-good" };
  if (pulse.kind === "steady") return { text: `Steady, about every ${plural(pulse.usualGap ?? 1, "day")}`, tone: "text-muted" };
  return { text: "New buyer", tone: "text-muted" };
}

function changeText(today: number, usual: number | null, money: boolean): { text: string; tone: string } {
  if (usual === null) return { text: "No history yet", tone: "text-muted" };
  if (usual === 0) return { text: today > 0 ? "None by now on a usual day" : "Quiet as usual", tone: "text-muted" };
  if (!money) {
    const usualText = Math.round(usual * 10) / 10;
    return today >= usual ? { text: `usually ${usualText} by now`, tone: "text-good" } : { text: `usually ${usualText} by now`, tone: "text-warn" };
  }
  const percent = Math.round(((today - usual) / usual) * 100);
  return percent >= 0 ? { text: `+${percent}% on a usual day`, tone: "text-good" } : { text: `${percent}% on a usual day`, tone: "text-warn" };
}

/** Supplier Home: beat the cut-off, pack, restock, with Tradelink AI's next step first (SUP-01). */
export default async function SupplierHomePage() {
  const session = await requireRole("supplier");
  const [openOrders, recentOrders, catalogue, issues, profile] = await Promise.all([
    getOrders({ supplierOrgId: session.orgId, statuses: OPEN_STATUSES, limit: 200 }),
    getOrders({ supplierOrgId: session.orgId, limit: 300 }),
    getCatalogue({ supplierOrgId: session.orgId }),
    getOpenIssues(session.orgId),
    getBusinessProfile(session.orgId),
  ]);
  const now = new Date();
  const today = singaporeDateOf(now);
  const firstName = session.fullName.split(" ")[0] ?? session.fullName;

  const pending = openOrders.filter((order) => order.status === "pending");
  const packToday = openOrders.filter((order) => order.status === "accepted" && deliveryDate(order) <= today);
  const comingUp = openOrders.filter((order) => order.status === "accepted" && deliveryDate(order) > today);
  const outOfStock = catalogue.filter((item) => item.health === "out");
  const lowStock = catalogue.filter(needsReorder);
  const placed = recentOrders.filter((order) => order.status !== "cancelled" && order.status !== "rejected");
  const pulse = customerPulse(placed.map((order) => ({ buyer: order.buyer.name, createdAt: order.createdAt })), now);
  const quiet = pulse.filter((entry) => entry.kind === "quiet");
  const day = usualDay(placed.map((order) => ({ createdAt: order.createdAt, totalCents: order.totalCents })), now);
  const cutoff = profile.cutoff.slice(0, 5);
  const minutesLeft = minutesToCutoff(profile.cutoff, now);
  const picks = pickList(packToday.map((order) => ({ buyer: order.buyer.name, lines: order.lines })));
  const packCents = packToday.reduce((sum, order) => sum + order.totalCents, 0);

  const steps: Step[] = [
    ...(pending.length > 0
      ? [
          {
            key: "accept",
            kind: "accept" as const,
            orders: pending,
            title: `Accept ${plural(pending.length, "new order")}`,
            subject: `${plural(pending.length, "new order")} to accept`,
            detail: [...new Set(pending.map((order) => order.buyer.name))].join(", "),
            href: "/supplier/orders",
            tone: "warn" as const,
          },
        ]
      : []),
    ...(packToday.length > 0
      ? [
          {
            key: "pack",
            kind: "pack" as const,
            orders: packToday,
            title: `Pack today's ${plural(packToday.length, "order")}`,
            subject: `today's ${plural(packToday.length, "order")} to pack`,
            detail: [...new Set(packToday.map((order) => order.buyer.name))].join(", "),
            href: "/supplier/orders#orders",
            tone: "info" as const,
          },
        ]
      : []),
    ...(issues.length > 0
      ? [
          {
            key: "issues",
            kind: "other" as const,
            title: `Answer ${plural(issues.length, "problem")}`,
            subject: `${plural(issues.length, "problem")} to answer`,
            detail: [...new Set(issues.map((issue) => issue.buyerName))].join(", "),
            href: "/supplier/orders#problems",
            tone: "bad" as const,
          },
        ]
      : []),
    ...outOfStock.map((item) => ({
      key: `restock-${item.id}`,
      kind: "other" as const,
      title: `Restock ${item.name}`,
      subject: `${item.name} to restock`,
      detail: `${item.available} free, ${item.reserved} reserved`,
      href: inventoryHref({ q: item.name }),
      tone: "bad" as const,
    })),
    ...quiet.slice(0, 2).map((entry) => ({
      key: `quiet-${entry.buyer}`,
      kind: "other" as const,
      title: `${entry.buyer} is quiet`,
      subject: `${entry.buyer} going quiet`,
      detail: `${entry.daysSince} days since their last order, usually ${entry.usualGap}`,
      href: "/supplier/orders",
      tone: "warn" as const,
    })),
  ];
  const [first, ...rest] = steps;

  const valueScale = Math.max(day.todayCents, day.usualCents ?? 0, 1) * 1.25;
  const countScale = Math.max(day.todayCount, day.usualCount ?? 0, 1) * 1.25;
  const valueChange = changeText(day.todayCents, day.usualCents, true);
  const countChange = changeText(day.todayCount, day.usualCount, false);

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7 rail:pt-2">
      <HomeGreeting
        eyebrow={`${formatLongDate(now)} · ${session.orgName}`}
        title={`${greeting(now)}, ${firstName}`}
        line={briefingLine(steps.map((step) => step.subject), now)}
        aside={<CutoffRing minutesLeft={minutesLeft} cutoff={cutoff} totalMinutes={Math.max(60, Number(cutoff.slice(0, 2)) * 60 + Number(cutoff.slice(3)) - 8 * 60)} />}
      >
        <AskBar
          action="/supplier/assistant"
          placeholder="Ask anything, or tell Tradelink AI what to do"
          stamp={String(now.getTime())}
          suggestions={["Which buyers are ordering less?", "What is low in stock?", "What sold most this week?"]}
        />
      </HomeGreeting>

      {first ? (
        <NextUp
          position={`1 of ${steps.length}`}
          title={first.title}
          detail={
            first.kind === "pack" ? (
              <>
                {first.detail}, <b className="font-semibold text-ink tabular-nums">{formatMoney(packCents)}</b>.
              </>
            ) : first.kind === "accept" ? (
              <>
                From {first.detail}. Orders accepted before {cutoff} can go on the next run.
              </>
            ) : (
              first.detail
            )
          }
          actions={
            first.kind === "pack" ? (
              <SendOutStepActions orderIds={first.orders.map((order) => order.id)} />
            ) : (
              <LinkButton href={first.href} variant="primary">
                {first.kind === "accept" ? "Review new orders" : "Open"}
              </LinkButton>
            )
          }
          why={
            first.kind === "pack"
              ? "These orders are due today. I added up the same products across them, so you pick each shelf once."
              : first.kind === "accept"
                ? `Buyers plan their stock around your answer, and your cut-off is ${cutoff}. Each order shows its lines and the stock you have.`
                : undefined
          }
          rest={rest.slice(0, 3).map((step) => (
            <StepRow key={step.key} title={step.title} detail={step.detail} href={step.href} tone={step.tone} />
          ))}
        >
          {first.kind === "pack" ? (
            <ul>
              {picks.map((line) => (
                <li key={line.productId} className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 border-t border-line py-2.5 rail:grid-cols-[52px_minmax(0,1fr)_auto]">
                  <span className="grid h-9 place-items-center rounded-[10px] bg-sunken text-[.95rem] font-semibold tabular-nums">{line.qty}</span>
                  <span className="min-w-0 text-[.92rem]">
                    <b className="font-semibold">{line.name}</b> <span className="text-muted">{line.unit}s</span>
                  </span>
                  <span className="col-start-2 text-[.8rem] text-muted rail:col-start-auto">
                    {line.buyers.map((buyer) => `${buyer.name} ${buyer.qty}`).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : first.kind === "accept" ? (
            <ul>
              {first.orders.slice(0, 4).map((order) => (
                <li key={order.id}>
                  <GlanceRow
                    href={`/supplier/orders#order-${order.number}`}
                    lead={<BusinessLogo name={order.buyer.name} size={30} />}
                    title={order.buyer.name}
                    detail={`${orderNumber(order.number)} · ${plural(order.lines.length, "line")}`}
                    end={<span className="text-[.84rem] font-semibold tabular-nums">{formatMoney(order.totalCents)}</span>}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </NextUp>
      ) : (
        <AllClear text="All caught up. No new orders, nothing to pack and no problems waiting." />
      )}

      <section aria-label="Today against a usual day" className="rounded-lg border border-line bg-surface px-5 py-5 shadow-card rail:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2>Today against a usual {formatLongDate(now).split(" ")[0]}</h2>
          <span className="inline-flex items-center gap-1.5 text-[.8rem] text-muted">
            <span aria-hidden="true" className="h-3 w-0.5 bg-ink" />
            usual by this time
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-4 rail:grid-cols-[120px_minmax(0,1fr)_220px] rail:items-center">
          <dt className="text-[.92rem] text-ink/80">Order value</dt>
          <dd className="contents">
            <CompareBar
              percent={(day.todayCents / valueScale) * 100}
              usualPercent={day.usualCents === null ? null : (day.usualCents / valueScale) * 100}
              tone="accent"
              label={`${formatMoney(day.todayCents)} today, ${day.usualCents === null ? "no history yet" : `${formatMoney(day.usualCents)} on a usual day by now`}`}
            />
            <span className="text-[.92rem]">
              <b className="font-semibold tabular-nums">{formatMoney(day.todayCents)}</b> <span className={valueChange.tone}>{valueChange.text}</span>
            </span>
          </dd>
          <dt className="text-[.92rem] text-ink/80">New orders</dt>
          <dd className="contents">
            <CompareBar
              percent={(day.todayCount / countScale) * 100}
              usualPercent={day.usualCount === null ? null : (day.usualCount / countScale) * 100}
              tone={day.usualCount !== null && day.todayCount < day.usualCount ? "warn" : "accent"}
              label={`${day.todayCount} today, ${day.usualCount === null ? "no history yet" : `${day.usualCount} on a usual day by now`}`}
            />
            <span className="text-[.92rem]">
              <b className="font-semibold tabular-nums">{day.todayCount}</b> <span className={countChange.tone}>{countChange.text}</span>
            </span>
          </dd>
        </dl>
      </section>

      <GlanceTabs
        tabs={[
          {
            id: "customers",
            label: "Customers",
            count: pulse.length,
            content:
              pulse.length === 0 ? (
                <p className="py-3 text-muted">Buyers show here once they order.</p>
              ) : (
                pulse.slice(0, 5).map((entry) => {
                  const text = pulseText(entry);
                  return (
                    <GlanceRow
                      key={entry.buyer}
                      lead={<BusinessLogo name={entry.buyer} size={30} />}
                      title={entry.buyer}
                      end={<span className={`text-[.84rem] ${text.tone}`}>{text.text}</span>}
                    />
                  );
                })
              ),
          },
          {
            id: "low",
            label: "Running low",
            count: lowStock.length,
            content:
              lowStock.length === 0 ? (
                <p className="py-3 text-muted">Every product is above its reorder level.</p>
              ) : (
                lowStock.slice(0, 6).map((item) => (
                  <GlanceRow
                    key={item.id}
                    href={inventoryHref({ q: item.name })}
                    title={item.name}
                    end={
                      <span className="flex w-[45%] items-center gap-3">
                        <LevelBar percent={(item.available / Math.max(1, item.reorderLevel * 2)) * 100} tone={item.available <= 0 ? "bad" : "warn"} />
                        <span className="w-[64px] flex-none text-right text-[.84rem] text-muted tabular-nums">{item.available} free</span>
                      </span>
                    }
                  />
                ))
              ),
          },
          {
            id: "coming",
            label: "Coming up",
            count: comingUp.length,
            content:
              comingUp.length === 0 ? (
                <p className="py-3 text-muted">No accepted orders for later days.</p>
              ) : (
                comingUp.slice(0, 5).map((order) => (
                  <GlanceRow
                    key={order.id}
                    href={`/supplier/orders#order-${order.number}`}
                    lead={<BusinessLogo name={order.buyer.name} size={30} />}
                    title={order.buyer.name}
                    detail={`${orderNumber(order.number)} · ${formatDate(deliveryDate(order))}`}
                    end={<span className="text-[.84rem] tabular-nums text-muted">{formatMoney(order.totalCents)}</span>}
                  />
                ))
              ),
          },
        ]}
      />
    </div>
  );
}
