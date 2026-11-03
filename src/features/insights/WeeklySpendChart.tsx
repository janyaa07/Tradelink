import type { WeekSpend } from "@/domain/insights";
import { formatMoney, type Cents } from "@/domain/money";
import { formatDate } from "@/ui/format";
import { cx } from "@/ui/cx";
import { Panel } from "@/ui/Panel";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "27 Oct" for "2026-10-27". */
function dayMonth(isoDate: string): string {
  const [, month = 1, day = 1] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

type WeeklySpendChartProps = {
  weeks: WeekSpend[];
  /** Bars are drawn against the larger of the busiest week and the weekly budget. */
  budgetCents: Cents;
};

/** Spend per week, Monday to Sunday in Singapore, with this week highlighted (BUY-39). */
export function WeeklySpendChart({ weeks, budgetCents }: WeeklySpendChartProps) {
  const thisWeek = weeks.at(-1)?.cents ?? 0;
  const scale = Math.max(budgetCents, ...weeks.map((week) => week.cents), 1);

  return (
    <Panel title="Weekly spend">
      <div
        role="img"
        aria-label={`Weekly spend for the last five weeks, ending ${formatMoney(thisWeek)} this week`}
        className="flex h-[170px] items-end gap-2"
      >
        {weeks.map((week) => (
          <div key={week.startDate} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[.8rem] font-semibold tabular-nums">
              {week.isThisWeek ? formatMoney(week.cents) : null}
            </span>
            <div className="flex w-full flex-1 items-end justify-center">
              <i
                className={cx(
                  "block w-full max-w-[44px] rounded-t-[4px] border border-b-0 border-accent",
                  week.isThisWeek ? "bg-accent" : "bg-accent-soft",
                )}
                style={{ height: `${Math.max(3, (week.cents / scale) * 100)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-[.72rem] text-muted">
              {week.isThisWeek ? "This week" : dayMonth(week.startDate)}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Weekly spend, Monday to Sunday</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Spend</th>
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
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[.8rem] text-muted">
        Monday to Sunday, Singapore time, by the day each order was placed. Rejected and cancelled orders are not counted.
      </p>
    </Panel>
  );
}
