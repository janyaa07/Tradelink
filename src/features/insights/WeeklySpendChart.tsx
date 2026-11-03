import type { WeekSpend } from "@/domain/insights";
import { formatMoney, type Cents } from "@/domain/money";
import { cx } from "@/ui/cx";
import { formatDate } from "@/ui/format";
import { Panel } from "@/ui/Panel";
import { dayMonth, formatWholeMoney } from "./format";
import styles from "./insights.module.css";

/** Room above the tallest bar or the budget line for its value label. */
const HEADROOM = 1.2;

type WeeklySpendChartProps = {
  weeks: WeekSpend[];
  /** The weekly budget, drawn as a dashed line; zero when none is set. */
  budgetCents: Cents;
};

function barColour(over: boolean, isThisWeek: boolean): string {
  if (over) return isThisWeek ? "var(--viz-over)" : "var(--viz-over-past)";
  return isThisWeek ? "var(--viz-bar)" : "var(--viz-bar-past)";
}

/** Columns of spend per week, Monday to Sunday in Singapore, against the weekly budget (BUY-39). */
export function WeeklySpendChart({ weeks, budgetCents }: WeeklySpendChartProps) {
  const hasBudget = budgetCents > 0;
  const scale = Math.max(hasBudget ? budgetCents : 0, ...weeks.map((week) => week.cents), 1) * HEADROOM;
  const isOver = (cents: Cents) => hasBudget && cents > budgetCents;
  const anyOver = weeks.some((week) => isOver(week.cents));
  const thisWeek = weeks.at(-1);
  const empty = weeks.every((week) => week.cents === 0);

  const summary = [
    `Column chart of spend for the last ${weeks.length} weeks.`,
    thisWeek ? `This week ${formatMoney(thisWeek.cents)}.` : "",
    hasBudget ? `Weekly budget ${formatMoney(budgetCents)}.` : "",
    anyOver ? `${weeks.filter((week) => isOver(week.cents)).length} over budget.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Panel title="Weekly spend" action={<span className="text-[.8rem] text-muted">Last {weeks.length} weeks</span>}>
      {empty ? (
        <p className="py-6 text-center text-muted">No spend in the last {weeks.length} weeks. Orders you place show here.</p>
      ) : (
        <figure className={cx(styles.viz, "m-0 flex flex-col gap-2")}>
          <div role="img" aria-label={summary} className="relative h-[180px] border-b border-(--viz-grid)">
            {/* Under the columns, so value labels sit on top of the line. */}
            {hasBudget ? (
              <span
                className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-(--viz-budget) opacity-70"
                style={{ bottom: `${(budgetCents / scale) * 100}%` }}
              />
            ) : null}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
              {weeks.map((week) => {
                const height = (week.cents / scale) * 100;
                const over = isOver(week.cents);
                return (
                  <div
                    key={week.startDate}
                    className="relative h-full"
                    title={`Week of ${dayMonth(week.startDate)}: ${formatMoney(week.cents)}${over ? ", over budget" : ""}`}
                  >
                    <span
                      className={cx(
                        "absolute inset-x-0 text-center text-[.72rem] leading-none whitespace-nowrap tabular-nums",
                        week.isThisWeek ? "font-bold text-ink" : "text-muted",
                      )}
                      style={{ bottom: `calc(${height}% + 4px)` }}
                    >
                      <span className="rounded-[3px] bg-surface px-1 py-px">{formatWholeMoney(week.cents)}</span>
                    </span>
                    <span
                      className={cx(styles.mark, "absolute bottom-0 left-1/2 w-[24px] -translate-x-1/2 rounded-t-[4px]")}
                      style={{ height: `${height}%`, background: barColour(over, week.isThisWeek) }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="grid text-center text-[.72rem] whitespace-nowrap"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weeks.map((week) => (
              <span key={week.startDate} className={week.isThisWeek ? "font-bold text-ink" : "text-muted"}>
                {week.isThisWeek ? "This week" : dayMonth(week.startDate)}
              </span>
            ))}
          </div>

          {hasBudget || anyOver ? (
            <figcaption aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-[.78rem] text-muted">
              {hasBudget ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-[1.5px] border-dashed border-(--viz-budget) opacity-70" />
                  Budget {formatMoney(budgetCents)}
                </span>
              ) : null}
              {anyOver ? (
                <span className="flex items-center gap-1.5">
                  <span className={cx(styles.mark, "size-2.5 rounded-[3px]")} style={{ background: "var(--viz-over)" }} />
                  Over budget
                </span>
              ) : null}
            </figcaption>
          ) : null}

          <table className="sr-only">
            <caption>Weekly spend, Monday to Sunday, Singapore time</caption>
            <thead>
              <tr>
                <th scope="col">Week starting</th>
                <th scope="col">Spend</th>
                <th scope="col">Against budget</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.startDate}>
                  <th scope="row">
                    {formatDate(week.startDate)}
                    {week.isThisWeek ? ", this week" : null}
                  </th>
                  <td>{formatMoney(week.cents)}</td>
                  <td>{hasBudget ? (isOver(week.cents) ? "Over budget" : "Within budget") : "No budget set"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
      <p className="text-[.78rem] text-muted">
        By the day each order was placed. Rejected and cancelled orders are not counted.
      </p>
    </Panel>
  );
}
