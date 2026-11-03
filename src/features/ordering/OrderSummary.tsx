"use client";

import { formatMoney, type Cents } from "@/domain/money";
import type { SupplierSubtotal } from "@/domain/review";
import { Button } from "@/ui/Button";

type Props = {
  groups: SupplierSubtotal[];
  totalCents: Cents;
  cutoffs: Record<string, string>;
  /** "This takes your week to …" when budget warnings are on and the order goes over. */
  budgetWarning: string | null;
  blockers: string[];
  placing: boolean;
  onPlace: () => void;
};

/** Per-supplier totals, cut-offs, budget warning and blockers, then Confirm and reserve stock (BUY-20, BUY-22). */
export function OrderSummary({ groups, totalCents, cutoffs, budgetWarning, blockers, placing, onPlace }: Props) {
  const disabled = placing || blockers.length > 0 || groups.length === 0;
  return (
    <aside
      aria-label="Order summary"
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-card min-[980px]:sticky min-[980px]:top-6"
    >
      <h2>{groups.length > 1 ? `Splits into ${groups.length} orders` : "Order summary"}</h2>
      <div className="flex flex-col gap-1.5 text-[.9rem]">
        {groups.length === 0 ? <span className="text-[.84rem] text-muted">Nothing selected yet.</span> : null}
        {groups.map((group) => (
          <div key={group.supplierOrgId} className="flex justify-between gap-2.5">
            <span>{group.supplierName}</span>
            <span className="tabular-nums">{formatMoney(group.totalCents)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-2.5 border-t border-line pt-[7px] font-semibold">
          <span>Total before GST</span>
          <span className="tabular-nums">{formatMoney(totalCents)}</span>
        </div>
      </div>
      {groups.map((group) =>
        cutoffs[group.supplierOrgId] ? (
          <p key={group.supplierOrgId} className="text-[.84rem] text-muted">
            {group.supplierName}: {cutoffs[group.supplierOrgId]}
          </p>
        ) : null,
      )}
      {budgetWarning ? <p className="text-[.84rem] font-semibold text-warn">{budgetWarning}</p> : null}
      {blockers.map((blocker) => (
        <p key={blocker} className="text-[.84rem] font-semibold text-warn">
          {blocker}
        </p>
      ))}
      <Button variant="primary" size="big" onClick={onPlace} disabled={disabled} aria-busy={placing || undefined}>
        {placing ? "Reserving stock..." : "Confirm and reserve stock"}
      </Button>
      <p className="text-[.8rem] text-muted">Nothing is sent or reserved until you confirm. Stock is checked again at that moment.</p>
    </aside>
  );
}
