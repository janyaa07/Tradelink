import { changeDirection, percentChange } from "@/domain/insights";
import { formatMoney, toCents } from "@/domain/money";
import { cx } from "@/ui/cx";
import { formatDateTime } from "@/ui/format";
import { Panel } from "@/ui/Panel";
import { formatPercent } from "./format";
import type { PriceChangeRow } from "./queries";

/** "▲ 7.1%": a rise is warn and a drop is good, always with the arrow and a spoken word. */
function Change({ oldPrice, newPrice }: { oldPrice: string; newPrice: string }) {
  const from = toCents(oldPrice);
  const to = toCents(newPrice);
  const direction = changeDirection(from, to);
  const percent = percentChange(from, to);
  if (direction === "same" || percent === null) return <span className="text-muted">No change</span>;
  const up = direction === "up";
  return (
    <span
      className={cx(
        "inline-block rounded-full px-2 py-0.5 text-[.75rem] font-semibold whitespace-nowrap tabular-nums",
        up ? "bg-warn-soft text-warn" : "bg-good-soft text-good",
      )}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {formatPercent(percent)}
    </span>
  );
}

type PriceChangesPanelProps = {
  changes: PriceChangeRow[];
  total: number;
};

/** Price changes on the buyer's usual items, newest first (BUY-41). */
export function PriceChangesPanel({ changes, total }: PriceChangesPanelProps) {
  return (
    <Panel title="Price changes" action={<span className="text-[.8rem] text-muted">On your usual items</span>}>
      {changes.length === 0 ? (
        <p className="py-4 text-center text-muted">No price changes on your usual items.</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {changes.map((change) => (
              <li
                key={change.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line py-2.5 text-[.88rem] last:border-b-0"
              >
                <span className="min-w-0 break-words">
                  {change.productName}
                  <span className="block text-[.78rem] text-muted">{formatDateTime(change.createdAt)}</span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-right">
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="text-muted">{formatMoney(change.oldPrice)}</span>
                    <span aria-hidden="true" className="mx-1 text-muted">
                      →
                    </span>
                    <span className="sr-only"> to </span>
                    <b className="font-semibold">{formatMoney(change.newPrice)}</b>
                  </span>
                  <Change oldPrice={change.oldPrice} newPrice={change.newPrice} />
                </span>
              </li>
            ))}
          </ul>
          {total > changes.length ? (
            <p className="text-[.78rem] text-muted">
              Showing the latest {changes.length} of {total} price changes.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
