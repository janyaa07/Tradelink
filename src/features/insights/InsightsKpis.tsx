import Link from "next/link";
import type { ReactNode } from "react";
import { budgetUse, changeDirection, percentChange, type Level } from "@/domain/insights";
import { formatMoney, type Cents } from "@/domain/money";
import { cx } from "@/ui/cx";
import { formatPercent, LEVEL_FILL, LEVEL_TEXT } from "./format";

type KpiProps = {
  label: string;
  value: ReactNode;
  /** One short line under the value: a change, a split or what the figure counts. */
  context: ReactNode;
  children?: ReactNode;
};

/** One figure in the divided strip: two across on a phone with a line between rows, four across from 620px. */
function Kpi({ label, value, context, children }: KpiProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-line px-4 py-3.5 even:border-l [&:nth-child(n+3)]:border-t @min-[620px]:border-l @min-[620px]:first:border-l-0 @min-[620px]:[&:nth-child(n+3)]:border-t-0">
      <dt className="text-[.8rem] font-medium text-muted">{label}</dt>
      <dd className="text-[1.5rem] leading-[1.15] font-semibold tracking-[-0.02em] break-words tabular-nums">{value}</dd>
      {children}
      <dd className="text-[.75rem] leading-[1.35] text-muted">{context}</dd>
    </div>
  );
}

/** "▲ 12% vs last week": spending more is warn, spending less is good, always with the arrow and words. */
function WeekChange({ thisWeek, lastWeek }: { thisWeek: Cents; lastWeek: Cents }) {
  const direction = changeDirection(lastWeek, thisWeek);
  const percent = percentChange(lastWeek, thisWeek);
  if (percent === null) return <>{thisWeek > 0 ? "No spend last week" : "Nothing spent yet"}</>;
  if (direction === "same") return <>Same as last week</>;
  const up = direction === "up";
  return (
    <span className={cx("font-semibold", up ? "text-warn" : "text-good")}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {formatPercent(percent)} vs last week
      <span className="sr-only"> ({formatMoney(lastWeek)})</span>
    </span>
  );
}

const BUDGET_WORD: Record<Level, string> = { good: "On track", warn: "Getting close", bad: "Over budget" };

type InsightsKpisProps = {
  spentCents: Cents;
  lastWeekCents: Cents;
  budgetCents: Cents;
  leftCents: Cents;
  caughtCents: Cents;
  priceChangeCount: number;
  priceChangesUp: number;
  priceChangesDown: number;
};

/** The four headline figures in one divided card: two across on phone, four across when there is room. */
export function InsightsKpis(props: InsightsKpisProps) {
  const use = budgetUse(props.budgetCents, props.spentCents);
  const over = props.spentCents - props.budgetCents;

  return (
    <div className="@container">
      <dl
        aria-label="This week at a glance"
        className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card @min-[620px]:grid-cols-4"
      >
        <Kpi
          label="Spent this week"
          value={formatMoney(props.spentCents)}
          context={<WeekChange thisWeek={props.spentCents} lastWeek={props.lastWeekCents} />}
        />

        {use ? (
          <Kpi
            label="Budget"
            value={
              <>
                {formatMoney(use.level === "bad" ? over : props.leftCents)}{" "}
                <span className="text-[.8rem] font-medium text-muted">{use.level === "bad" ? "over" : "left"}</span>
              </>
            }
            context={
              <>
                <span className={cx("font-semibold", LEVEL_TEXT[use.level])}>{BUDGET_WORD[use.level]}</span>
                {` · ${use.percent}% of ${formatMoney(props.budgetCents)}`}
              </>
            }
          >
            <dd aria-hidden="true" className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <span className={cx("block h-full rounded-full", LEVEL_FILL[use.level])} style={{ width: `${Math.min(100, use.percent)}%` }} />
            </dd>
          </Kpi>
        ) : (
          <Kpi
            label="Budget"
            value="Not set"
            context={
              <Link href="/buyer/settings#budget" className="text-accent">
                Set a weekly budget
              </Link>
            }
          />
        )}

        <Kpi label="Overcharges caught" value={formatMoney(props.caughtCents)} context="Credits promised or received" />

        <Kpi
          label="Price changes"
          value={props.priceChangeCount}
          context={
            props.priceChangeCount === 0 ? (
              "None on your usual items"
            ) : (
              <>
                <span className="font-semibold text-warn">
                  <span aria-hidden="true">▲ </span>
                  {props.priceChangesUp} up
                </span>
                {" · "}
                <span className="font-semibold text-good">
                  <span aria-hidden="true">▼ </span>
                  {props.priceChangesDown} down
                </span>
              </>
            )
          }
        />
      </dl>
    </div>
  );
}
