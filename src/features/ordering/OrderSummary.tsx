"use client";

import { formatMoney, type Cents } from "@/domain/money";
import type { SupplierSubtotal } from "@/domain/review";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";

type Props = {
  subtotals: SupplierSubtotal[];
  totalCents: Cents;
  cutoffs: Record<string, string>;
  /** "This takes your week to …" when budget warnings are on and the order goes over. */
  budgetWarning: string | null;
  blockers: string[];
  placing: boolean;
  onPlace: () => void;
};

export function canPlace({ subtotals, blockers, placing }: Pick<Props, "subtotals" | "blockers" | "placing">): boolean {
  return !placing && blockers.length === 0 && subtotals.length > 0;
}

function PlaceButton({ placing, disabled, onPlace, className }: { placing: boolean; disabled: boolean; onPlace: () => void; className?: string }) {
  return (
    <Button variant="primary" size="big" className={className} onClick={onPlace} disabled={disabled} aria-busy={placing || undefined}>
      {placing ? "Placing order..." : "Place order"}
    </Button>
  );
}

/** Per-supplier subtotals, cut-offs, budget warning and blockers, then Place order (BUY-20, BUY-22). */
export function OrderSummary(props: Props) {
  const { subtotals, totalCents, cutoffs, budgetWarning, blockers, placing, onPlace } = props;
  const disabled = !canPlace(props);
  return (
    <aside
      aria-label="Order summary"
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card @min-[900px]:sticky @min-[900px]:top-0"
    >
      <h2>{subtotals.length > 1 ? `Splits into ${subtotals.length} orders` : "Summary"}</h2>
      <div className="flex flex-col gap-1.5 text-[.92rem]">
        {subtotals.length === 0 ? <span className="text-[.84rem] text-muted">Nothing to place yet.</span> : null}
        {subtotals.map((group) => (
          <div key={group.supplierOrgId} className="flex flex-col">
            <div className="flex justify-between gap-2.5">
              <span className="min-w-0 [overflow-wrap:anywhere]">{group.supplierName}</span>
              <span className="tabular-nums">{formatMoney(group.totalCents)}</span>
            </div>
            {cutoffs[group.supplierOrgId] ? <span className="text-[.8rem] text-muted">{cutoffs[group.supplierOrgId]}</span> : null}
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-2.5 border-t border-line pt-2 font-semibold">
          <span>Total before GST</span>
          <span className="tabular-nums">{formatMoney(totalCents)}</span>
        </div>
      </div>
      {budgetWarning ? <p className="text-[.84rem] font-semibold text-warn">{budgetWarning}</p> : null}
      {blockers.map((blocker) => (
        <p key={blocker} className="text-[.84rem] font-semibold text-warn">
          {blocker}
        </p>
      ))}
      <div className="hidden @min-[900px]:block">
        <PlaceButton placing={placing} disabled={disabled} onPlace={onPlace} />
      </div>
      <p className="text-[.8rem] text-muted">Each supplier gets its own order. Stock is checked and reserved when you place it.</p>
    </aside>
  );
}

/** Phone: the total and Place order stay in reach at the bottom of the screen while scrolling the cart. */
export function PlaceBar(props: Props) {
  const { totalCents, blockers, placing, onPlace } = props;
  return (
    <div
      className={cx(
        "sticky bottom-0 z-10 -mx-1 flex flex-col gap-1.5 border-t border-line bg-bg px-1 pt-2.5 pb-2 @min-[900px]:hidden",
        "after:absolute after:inset-x-0 after:top-full after:h-9 after:bg-bg",
      )}
    >
      {blockers[0] ? <p className="text-[.82rem] font-semibold text-warn">{blockers[0]}</p> : null}
      <div className="flex items-center gap-3">
        <span className="flex flex-col">
          <span className="text-[.75rem] text-muted">Total before GST</span>
          <b className="tabular-nums">{formatMoney(totalCents)}</b>
        </span>
        <PlaceButton placing={placing} disabled={!canPlace(props)} onPlace={onPlace} className="flex-1" />
      </div>
    </div>
  );
}
