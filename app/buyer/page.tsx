import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { plural } from "@/domain/catalogue";
import { briefingLine, weekPace } from "@/domain/home";
import { formatMoney, toCents } from "@/domain/money";
import { daysLeft, formatDaysLeft } from "@/domain/reorder";
import { getBuyerCatalogue, getBuyerSettings, getLastWeekSpendCents, getOnOrder, getUsualItems, getWeekSpendCents } from "@/features/buyer/queries";
import type { ReorderPlanView } from "@/features/buyer/reorder-plan";
import { GlanceTabs } from "@/features/home/GlanceTabs";
import { AskBar, CompareBar, GlanceRow, HomeGreeting, LevelBar, StepRow } from "@/features/home/HomeParts";
import { AllClear, NextUp } from "@/features/home/NextUp";
import { PlanStepActions } from "@/features/home/StepActions";
import { loadBuyerSteps } from "@/features/home/steps";
import { formatDate, formatLongDate, greeting, orderNumber } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";

export const metadata: Metadata = { title: "Home · Tradelink" };

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
  const [{ steps, todos, plan, deliveries }, spentCents, lastWeekCents, settings, usuals, catalogue, onOrder] = await Promise.all([
    loadBuyerSteps(session.orgId, now),
    getWeekSpendCents(session.orgId),
    getLastWeekSpendCents(session.orgId),
    getBuyerSettings(session.orgId),
    getUsualItems(session.orgId),
    getBuyerCatalogue(),
    getOnOrder(session.orgId),
  ]);
  const firstName = session.fullName.split(" ")[0] ?? session.fullName;

  const suppliers = new Set(plan.rows.map((row) => row.item.supplierOrgId)).size;
  const [first, ...rest] = steps;

  const budgetCents = toCents(settings.weeklyBudget);
  const paceCents = weekPace(spentCents, now);
  const spareCents = budgetCents - paceCents;
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
  const priceTodos = todos.filter((todo) => todo.action.kind === "price");

  return (
    <div className="flex w-full flex-col gap-5">
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

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {first ? (
          <NextUp
            position={`1 of ${steps.length}`}
            title={first.title}
            detail={
              first.kind === "plan" ? (
                <>
                  {plural(plan.rows.length, "item")}, <b className="font-semibold text-ink tabular-nums">{formatMoney(plan.totalCents)}</b>.{" "}
                  {plan.cutoffLines[0] ?? ""}
                </>
              ) : first.kind === "delivery" ? (
                <>
                  {first.order.supplier.name} delivered {orderNumber(first.order.number)}. Check it so anything short or damaged is credited.
                </>
              ) : (
                first.detail
              )
            }
            actions={
              first.kind === "plan" ? (
                <PlanStepActions orders={suppliers} />
              ) : (
                <LinkButton href={first.href} variant="primary">
                  {first.kind === "delivery" ? "Check delivery" : "Open"}
                </LinkButton>
              )
            }
            why={
              first.kind === "plan"
                ? planWhy(plan)
                : first.kind === "delivery"
                  ? "A problem is credited only when it is reported against the delivery, and checking takes under a minute."
                  : undefined
            }
            rest={rest.slice(0, 3).map((step) => (
              <StepRow key={step.key} title={step.title} detail={step.detail} href={step.href} tone={step.tone} />
            ))}
          >
            {first.kind === "plan" ? (
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
            ) : null}
          </NextUp>
        ) : (
          <AllClear text="Nothing needs you right now. Your usual items are covered and every delivery is checked." />
        )}
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="This week" className="rounded-lg border border-line bg-surface p-4 shadow-card rail:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2>This week</h2>
              {lastWeekCents > 0 ? (
                <span className={`text-[.78rem] font-medium ${change <= 0 ? "text-good" : "text-warn"}`}>
                  {formatMoney(Math.abs(change))} {change <= 0 ? "less" : "more"} than this time last week
                </span>
              ) : null}
            </div>
            <p className="mt-2 flex flex-wrap items-baseline gap-2.5">
              <span className="text-[1.5rem] font-semibold tracking-[-0.02em] tabular-nums">{formatMoney(spentCents)}</span>
              <span className="text-[.85rem] text-muted">spent of {formatMoney(budgetCents)}</span>
            </p>
            <div className="mt-3.5">
              <CompareBar
                percent={(spentCents / Math.max(1, budgetCents)) * 100}
                usualPercent={(paceCents / Math.max(1, budgetCents)) * 100}
                tone={paceCents > budgetCents ? "warn" : "accent"}
                label={`Spent ${formatMoney(spentCents)}, on pace for ${formatMoney(paceCents)}, budget ${formatMoney(budgetCents)}`}
              />
            </div>
            <p className="mt-2.5 text-[.84rem] text-muted">
              On pace for <b className="font-semibold text-ink tabular-nums">{formatMoney(paceCents)}</b> by Sunday ·{" "}
              {spareCents >= 0 ? (
                `${formatMoney(spareCents)} to spare`
              ) : (
                <span className="font-semibold text-warn">{formatMoney(-spareCents)} over budget</span>
              )}
            </p>
          </section>

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
                count: runway.filter((entry) => entry.days < 4).length,
                content:
                  runway.length === 0 ? (
                    <p className="py-3 text-muted">Add usual items to see how long your stock lasts.</p>
                  ) : (
                    runway.map(({ usual, item, days }) => (
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
                count: priceTodos.length,
                content:
                  priceTodos.length === 0 ? (
                    <p className="py-3 text-muted">No price changes on your usual items.</p>
                  ) : (
                    priceTodos.map((todo) => <GlanceRow key={todo.key} href="/buyer/notifications" title={todo.title} detail={todo.detail} />)
                  ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
