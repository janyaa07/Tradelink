import { onTimeLevel, type Level } from "@/domain/insights";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Panel } from "@/ui/Panel";
import { Pill } from "@/ui/Pill";
import { LEVEL_TONE } from "./format";
import type { SupplierRecordRow } from "./queries";

const ON_TIME_WORD: Record<Level, string> = { good: "Reliable", warn: "Some late", bad: "Often late" };

/** "98% · Reliable": the level word goes with the colour. */
function OnTimePill({ percent }: { percent: number | null }) {
  const level = onTimeLevel(percent);
  if (percent === null || level === null) return <Pill>No deliveries yet</Pill>;
  return (
    <Pill tone={LEVEL_TONE[level]}>
      {percent}% · {ON_TIME_WORD[level]}
    </Pill>
  );
}

function Problems({ count }: { count: number }) {
  return count === 0 ? <span className="text-muted">None</span> : <span className="tabular-nums">{count}</span>;
}

/** On time, problems and cut-off for each connected active supplier the buyer has ordered from (BUY-40). */
export function SupplierRecordList({ rows }: { rows: SupplierRecordRow[] }) {
  return (
    <Panel title="Supplier record">
      {rows.length === 0 ? (
        <p className="py-4 text-center text-muted">
          Your supplier record appears after your first order with a connected supplier.
        </p>
      ) : (
        <div className="@container">
          <table className="hidden w-full border-collapse text-left text-[.88rem] @min-[440px]:table">
            <caption className="sr-only">
              Supplier record: on-time deliveries, problems reported and order cut-off, Singapore time
            </caption>
            <thead>
              <tr className="border-b border-line text-[.78rem] text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Supplier
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  On time
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Problems
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Cut-off
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-2.5 pr-3 font-semibold">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <BusinessLogo name={row.name} seedKey={row.id} size={28} />
                      <span className="min-w-0 break-words">{row.name}</span>
                    </span>
                  </th>
                  <td className="py-2.5 pr-3">
                    <OnTimePill percent={row.onTime} />
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <Problems count={row.problems} />
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{row.cutoff}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col @min-[440px]:hidden">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 border-b border-line py-2.5 last:border-b-0">
                <span className="flex min-w-0 items-center gap-2.5">
                  <BusinessLogo name={row.name} seedKey={row.id} size={28} />
                  <b className="min-w-0 break-words text-[.88rem]">{row.name}</b>
                </span>
                <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[.82rem]">
                  <div className="flex items-center gap-1.5">
                    <dt className="text-muted">On time</dt>
                    <dd>
                      <OnTimePill percent={row.onTime} />
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Problems</dt>
                    <dd>
                      <Problems count={row.problems} />
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Cut-off</dt>
                    <dd className="tabular-nums">{row.cutoff}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[.78rem] text-muted">On time: 95% or more is reliable, 85% to 94% some late, below 85% often late.</p>
        </div>
      )}
    </Panel>
  );
}
