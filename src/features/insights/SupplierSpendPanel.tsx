import { formatMoney } from "@/domain/money";
import { cx } from "@/ui/cx";
import { Panel } from "@/ui/Panel";
import styles from "./insights.module.css";
import type { SupplierSpendRow } from "./queries";

/** The supplier's own categorical colour; "Other" is neutral grey. */
function sliceColour(slot: number | null): string {
  return slot === null ? "var(--viz-other)" : `var(--viz-${slot + 1})`;
}

/** Share of the last five weeks' spend per supplier: one stacked bar and a legend with percent and amount (BUY-40). */
export function SupplierSpendPanel({ rows, weeks }: { rows: SupplierSpendRow[]; weeks: number }) {
  const total = rows.reduce((sum, row) => sum + row.cents, 0);
  const summary = `Share of spend by supplier, last ${weeks} weeks: ${rows
    .map((row) => `${row.name} ${row.percent}%`)
    .join(", ")}.`;

  return (
    <Panel title="Spend by supplier" action={<span className="text-[.8rem] text-muted">Last {weeks} weeks</span>}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-muted">No spend in the last {weeks} weeks. Orders you place show here.</p>
      ) : (
        <figure className={cx(styles.viz, "m-0 flex flex-col gap-3.5")}>
          <div role="img" aria-label={summary} className="flex h-3.5 gap-[2px] overflow-hidden rounded-[4px]">
            {rows.map((row) => (
              <span
                key={row.id ?? "other"}
                title={`${row.name}: ${row.percent}%, ${formatMoney(row.cents)}`}
                className={cx(styles.mark, "block h-full min-w-[3px]")}
                style={{ flexGrow: row.cents, flexBasis: 0, background: sliceColour(row.slot) }}
              />
            ))}
          </div>

          <ul aria-hidden="true" className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id ?? "other"}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 border-b border-line py-2 text-[.88rem] last:border-b-0"
              >
                <span
                  className={cx(styles.mark, "size-2.5 translate-y-[1px] self-center rounded-[3px]")}
                  style={{ background: sliceColour(row.slot) }}
                />
                <span className="min-w-0 break-words">{row.name}</span>
                <span className="whitespace-nowrap text-right tabular-nums">
                  <b className="font-semibold">{row.percent}%</b>
                  <span className="ml-2 text-muted">{formatMoney(row.cents)}</span>
                </span>
              </li>
            ))}
          </ul>

          <table className="sr-only">
            <caption>Spend by supplier, last {weeks} weeks</caption>
            <thead>
              <tr>
                <th scope="col">Supplier</th>
                <th scope="col">Share</th>
                <th scope="col">Spend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id ?? "other"}>
                  <th scope="row">{row.name}</th>
                  <td>{row.percent}%</td>
                  <td>{formatMoney(row.cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>100%</td>
                <td>{formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>

          <p aria-hidden="true" className="flex justify-between text-[.8rem] text-muted">
            <span>Total</span>
            <b className="font-semibold text-ink tabular-nums">{formatMoney(total)}</b>
          </p>
        </figure>
      )}
    </Panel>
  );
}
