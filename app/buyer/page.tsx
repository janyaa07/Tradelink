import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/data/session";
import { plural } from "@/domain/catalogue";
import { briefingLine, weekPace } from "@/domain/home";
import { formatMoney, toCents } from "@/domain/money";
import { daysLeft, formatDaysLeft } from "@/domain/reorder";
import { getBuyerCatalogue, getBuyerSettings, getLastWeekSpendCents, getOnOrder, getUsualItems, getWeekSpendCents } from "@/features/buyer/queries";
import type { ReorderPlanView } from "@/features/buyer/reorder-plan";
import { GlanceTabs } from "@/features/home/GlanceTabs";
import { getPriceChanges } from "@/features/insights/queries";
import { AskBar, CompareBar, GlanceRow, HomeGreeting, LevelBar } from "@/features/home/HomeParts";
import { AllClear, NextUp, type NextStep } from "@/features/home/NextUp";
import { PlanStepActions } from "@/features/home/StepActions";
import { loadBuyerSteps } from "@/features/home/steps";
import { formatDate, formatLongDate, greeting, orderNumber } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";

export const metadata: Metadata = { title: "Home · Tradelink" };

/** "S$3,000" for round amounts, "S$2,039" for the rest: the card reads at a glance. */
function wholeDollars(cents: number): string {
  return formatMoney(Math.round(cents / 100) * 100).replace(/\.00$/, "");
}

function planWhy(plan: ReorderPlanView): string {
  const reasons = plan.rows.slice(0, 2).map((row) => {
    const short =
      row.qty < row.want
        ? ` Only ${row.qty} ${row.qty === 1 ? "is" : "are"} available from ${row.item.supplierName}, so that is what I suggest.`
        : "";
    return `You use about ${plural(Math.round(row.usePerDay * 10) / 10, row.item.unit)} of ${row.item.name} a day and have ${row.inShop} left, so it runs out in ${formatDaysLeft(row.daysLeft)} days.${short}`;
  });
  return `${reasons.join(" ")} The quantities cover about a week.`;
}

/** Buyer Home: one next step from Tradelink AI, the week's spend and the rest at a glance (BUY-01). */
export default async function BuyerHomePage() {
  const session = await requireRole("buyer");
  const now = new Date();
  const [{ steps, plan, deliveries }, spentCents, lastWeekCents, settings, usuals, catalogue, onOrder] = await Promise.all([
    loadBuyerSteps(session.orgId, now),
    getWeekSpendCents(session.orgId),
    getLastWeekSpendCents(session.orgId),
    getBuyerSettings(session.orgId),
    getUsualItems(session.orgId),
    getBuyerCatalogue(),
    getOnOrder(session.orgId),
  ]);
  const firstName = session.fullName.split(" ")[0] ?? session.fullName;
  const prices = await getPriceChanges(usuals.map((usual) => usual.productId));

  const suppliers = new Set(plan.rows.map((row) => row.item.supplierOrgId)).size;

  const budgetCents = toCents(settings.weeklyBudget);
  const paceCents = weekPace(spentCents, now);
  const change = spentCents - lastWeekCents;

  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const runway = usuals
    .filter((usual) => usual.usePerDay > 0 && byId.has(usual.productId))
    .map((usual) => ({
      usual,
      item: byId.get(usual.productId),
      days: daysLeft(usual.inShop, onOrder.get(usual.productId) ?? 0, usual.usePerDay),
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  const lowRunway = runway.filter((entry) => entry.days < 4);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <HomeGreeting
        eyebrow={`${formatLongDate(now)} · ${session.orgName}`}
        title={`${greeting(now)}, ${firstName}`}
        line={briefingLine(
          steps.map((step) => step.subject),
          now,
        )}
      >
        <AskBar
          action="/buyer/assistant"
          placeholder="Ask anything, or tell Tradelink AI what to order"
          stamp={String(now.getTime())}
          suggestions={["What did I spend this month?", "Which supplier is cheapest for rice?", "Plan Friday's order"]}
        />
      </HomeGreeting>

      <div className="flex flex-col gap-5">
        {steps.length > 0 ? (
          <NextUp
            steps={steps.map((step): NextStep => {
              const base = { key: step.key, title: step.title, summary: step.detail, tone: step.tone };
              if (step.kind === "plan") {
                return {
                  ...base,
                  detail: (
                    <>
                      {plural(plan.rows.length, "item")}, <b className="font-semibold text-ink tabular-nums">{formatMoney(plan.totalCents)}</b>.{" "}
                      {plan.cutoffLines[0] ?? ""}
                    </>
                  ),
                  extra: (
                    <ul className="flex flex-wrap gap-2">
                      {plan.rows.map((row) => (
                        <li key={row.productId} className="flex items-center gap-2 rounded-[10px] bg-sunken py-1.5 pr-3 pl-1.5 text-[.875rem]">
                          <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-surface px-1 text-[.8rem] font-semibold tabular-nums">
                            {row.qty}
                          </span>
                          <b className="font-semibold">{row.item.name}</b>
                          <span className="text-muted">{row.item.supplierName}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                  actions: <PlanStepActions orders={suppliers} />,
                  why: planWhy(plan),
                };
              }
              if (step.kind === "delivery") {
                return {
                  ...base,
                  detail: `${step.order.supplier.name} delivered ${orderNumber(step.order.number)}. Check it so anything short or damaged is credited.`,
                  actions: (
                    <LinkButton href={step.href} variant="primary">
                      Check delivery
                    </LinkButton>
                  ),
                  why: "A problem is credited only when it is reported against the delivery, and checking takes under a minute.",
                };
              }
              return {
                ...base,
                detail: step.detail,
                actions: (
                  <LinkButton href={step.href} variant="primary">
                    Open
                  </LinkButton>
                ),
              };
            })}
          />
        ) : (
          <AllClear text="Nothing needs you right now. Your usual items are covered and every delivery is checked." />
        )}
        <div className="flex min-w-0 flex-col gap-5">
          <Link
            href="/buyer/insights"
            aria-label="This week's spend. Open Insights"
            className="block rounded-lg border border-line bg-surface p-4 text-ink no-underline shadow-card transition-[border-color,box-shadow] duration-150 hover:border-accent/40 hover:shadow-float rail:px-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2>This week</h2>
              {lastWeekCents > 0 ? (
                <Pill tone={change <= 0 ? "good" : "warn"}>
                  {change <= 0 ? "↓" : "↑"} {wholeDollars(Math.abs(change))} vs last week
                </Pill>
              ) : null}
            </div>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="text-[1.5rem] font-semibold tracking-[-0.02em] tabular-nums">{formatMoney(spentCents)}</span>
              <span className="text-[.85rem] text-muted">of {wholeDollars(budgetCents)}</span>
            </p>
            <div className="mt-3">
              <CompareBar
                percent={(spentCents / Math.max(1, budgetCents)) * 100}
                usualPercent={(paceCents / Math.max(1, budgetCents)) * 100}
                tone={paceCents > budgetCents ? "warn" : "accent"}
                label={`Spent ${formatMoney(spentCents)}, on pace for ${formatMoney(paceCents)}, budget ${formatMoney(budgetCents)}`}
              />
            </div>
            <p className={`mt-2 flex items-center gap-1.5 text-[.78rem] ${paceCents > budgetCents ? "font-semibold text-warn" : "text-muted"}`}>
              <span aria-hidden="true" className="h-3 w-0.5 bg-ink" />
              {paceCents > budgetCents ? `On pace to go ${wholeDollars(paceCents - budgetCents)} over` : `On pace for ${wholeDollars(paceCents)}`}
            </p>
          </Link>

          <GlanceTabs
            tabs={[
              {
                id: "deliveries",
                label: "Deliveries",
                count: deliveries.length,
                content:
                  deliveries.length === 0 ? (
                    <p className="py-3 text-muted">Nothing on the way or waiting to be checked.</p>
                  ) : (
                    deliveries.slice(0, 5).map((order) => {
                      const date = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
                      const onTheWay = order.status === "out_for_delivery";
                      return (
                        <GlanceRow
                          key={order.id}
                          href={`/buyer/orders/${order.id}`}
                          title={order.supplier.name}
                          detail={`${orderNumber(order.number)}${date ? ` · ${formatDate(date)}` : ""}`}
                          end={<Pill tone={onTheWay ? "info" : "warn"}>{onTheWay ? "On the way" : "To check"}</Pill>}
                        />
                      );
                    })
                  ),
              },
              {
                id: "low",
                label: "Running low",
                count: lowRunway.length,
                content:
                  lowRunway.length === 0 ? (
                    <p className="py-3 text-muted">
                      {runway.length === 0 ? "Add usual items to see how long your stock lasts." : "Nothing runs out in the next 4 days."}
                    </p>
                  ) : (
                    lowRunway.map(({ usual, item, days }) => (
                      <GlanceRow
                        key={usual.productId}
                        title={item?.name ?? ""}
                        end={
                          <span className="flex w-[45%] items-center gap-3">
                            <LevelBar percent={(days / 14) * 100} tone={days < 2 ? "bad" : days < 4 ? "warn" : "plain"} />
                            <span className="w-[72px] flex-none text-right text-[.84rem] text-muted tabular-nums">{formatDaysLeft(days)} days</span>
                          </span>
                        }
                      />
                    ))
                  ),
              },
              {
                id: "prices",
                label: "Prices",
                count: prices.latest.length,
                content:
                  prices.latest.length === 0 ? (
                    <p className="py-3 text-muted">No price changes on your usual items.</p>
                  ) : (
                    prices.latest.map((row) => {
                      const percent = Math.round(((toCents(row.newPrice) - toCents(row.oldPrice)) / Math.max(1, toCents(row.oldPrice))) * 1000) / 10;
                      return (
                        <GlanceRow
                          key={row.id}
                          href="/buyer/insights"
                          title={row.productName}
                          detail={`${formatMoney(row.oldPrice)} → ${formatMoney(row.newPrice)}`}
                          end={<Pill tone={percent > 0 ? "warn" : "good"}>{`${percent > 0 ? "+" : ""}${percent}%`}</Pill>}
                        />
                      );
                    })
                  ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
