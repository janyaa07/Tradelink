import { formatMoney } from "@/domain/money";
import { formatDateTime } from "@/ui/format";
import { Panel } from "@/ui/Panel";
import type { PriceChangeRow } from "./queries";

type PriceChangesPanelProps = {
  changes: PriceChangeRow[];
  total: number;
};

/** Price changes on the buyer's usual items, newest first (BUY-41). */
export function PriceChangesPanel({ changes, total }: PriceChangesPanelProps) {
  return (
    <Panel title="Price changes">
      {changes.length === 0 ? (
        <p className="text-muted">No price changes on your usual items.</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {changes.map((change) => (
              <li
                key={change.id}
                className="flex justify-between gap-2.5 border-b border-line py-2 text-[.88rem] last:border-b-0"
              >
                <span className="min-w-0 break-words">
                  {change.productName}
                  <span className="block text-[.8rem] text-muted">{formatDateTime(change.createdAt)}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {formatMoney(change.oldPrice)} to {formatMoney(change.newPrice)}
                </span>
              </li>
            ))}
          </ul>
          {total > changes.length ? (
            <p className="text-[.8rem] text-muted">
              Showing the latest {changes.length} of {total} price changes.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
