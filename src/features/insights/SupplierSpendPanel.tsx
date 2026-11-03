import { formatMoney } from "@/domain/money";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Panel } from "@/ui/Panel";
import type { SupplierSpendRow } from "./queries";

/** A bar per supplier with logo, name and amount, largest first (BUY-40). */
export function SupplierSpendPanel({ rows }: { rows: SupplierSpendRow[] }) {
  const largest = Math.max(1, ...rows.map((row) => row.cents));
  return (
    <Panel title="Spend by supplier" action={<span className="text-[.8rem] text-muted">Last five weeks</span>}>
      {rows.length === 0 ? (
        <p className="text-muted">No spend in the last five weeks.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-[3px] text-[.9rem]">
              <span className="flex min-w-0 items-center gap-2">
                <BusinessLogo name={row.name} seedKey={row.id} size={24} />
                <span className="min-w-0 break-words">{row.name}</span>
              </span>
              <b className="tabular-nums">{formatMoney(row.cents)}</b>
              <span aria-hidden="true" className="col-span-full block h-1.5 overflow-hidden rounded-[3px] bg-sunken">
                <span
                  className="block h-full rounded-[3px] bg-accent"
                  style={{ width: `${(row.cents / largest) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
