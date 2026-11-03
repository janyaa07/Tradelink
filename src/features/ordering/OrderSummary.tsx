"use client";

import { plural } from "@/domain/catalogue";
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
  /** Placed orders this week, Monday to Sunday in Singapore. */
  weekSpentCents: Cents;
  /** The weekly budget; zero when none is set. */
  budgetCents: Cents;
  placing: boolean;
  onPlace: () => void;
};

export function canPlace({ subtotals, blockers, placing }: Pick<Props, "subtotals" | "blockers" | "placing">): boolean {
  return !placing && blockers.length === 0 && subtotals.length > 0;
}

function placeLabel(orders: number, totalCents: Cents): string {
  if (orders === 0) return "Place order";
  return `Place ${orders === 1 ? "order" : plural(orders, "order")} · ${formatMoney(totalCents)}`;
}

function PlaceButton({
  placing,
  disabled,
  onPlace,
  label,
  className,
}: {
  placing: boolean;
  disabled: boolean;
  onPlace: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Button variant="primary" size="big" className={className} onClick={onPlace} disabled={disabled} aria-busy={placing || undefined}>
      {placing ? "Placing order..." : label}
    </Button>
  );
}

/** The week's spend, then this order on top, against the weekly budget. */
function BudgetImpact({ weekSpentCents, totalCents, budgetCents }: Pick<Props, "weekSpentCents" | "totalCents" | "budgetCents">) {
  if (budgetCents <= 0) return null;
  const after = weekSpentCents + totalCents;
  const spentShare = Math.min(100, (weekSpentCents / budgetCents) * 100);
  const orderShare = Math.min(100 - spentShare, (totalCents / budgetCents) * 100);
  const over = after > budgetCents;
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="relative block h-2 overflow-hidden rounded-full bg-sunken">
        <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${spentShare}%` }} />
        <span className={cx("absolute inset-y-0", over ? "bg-warn" : "bg-accent/45")} style={{ left: `${spentShare}%`, width: `${orderShare}%` }} />
      </span>
      <p className="text-[.75rem] text-muted">
        This week after this order: <b className="num font-semibold text-ink">{formatMoney(after)}</b> of {formatMoney(budgetCents)}
      </p>
    </div>
  );
}

/** What the cart check found: the blockers, or that every line is ready. */
function CheckLine({ blockers }: { blockers: string[] }) {
  return (
    <p className="ai-tint flex gap-2 rounded-lg px-3 py-2.5 text-[.8rem] leading-normal">
      <span aria-hidden="true" className="ai-spark mt-0.5 size-3.5" />
      <span>
        <b className="ai-text font-semibold">Checked:</b>{" "}
        {blockers.length > 0 ? (
          <span className="font-semibold text-warn">{blockers.join(" ")}</span>
        ) : (
          "every line matches a product and is in stock."
        )}
      </span>
    </p>
  );
}

/** Per-supplier subtotals, the total, budget impact, the cart check and Place order (BUY-20, BUY-22). */
export function OrderSummary(props: Props) {
  const { subtotals, totalCents, cutoffs, budgetWarning, blockers, weekSpentCents, budgetCents, placing, onPlace } = props;
  const disabled = !canPlace(props);
  return (
    <aside
      aria-label="Order summary"
      className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-line bg-surface p-4 shadow-card @min-[900px]:sticky @min-[900px]:top-4"
    >
      <h2>{subtotals.length > 1 ? `Splits into ${subtotals.length} orders` : "Summary"}</h2>
      <div className="flex flex-col text-[.84rem]">
        {subtotals.length === 0 ? <span className="text-muted">Nothing to place yet.</span> : null}
        {subtotals.map((group) => (
          <div key={group.supplierOrgId} className="flex flex-col py-1">
            <div className="flex justify-between gap-2.5">
              <span className="min-w-0 text-muted [overflow-wrap:anywhere]">{group.supplierName}</span>
              <span className="num">{formatMoney(group.totalCents)}</span>
            </div>
            {cutoffs[group.supplierOrgId] ? <span className="text-[.75rem] text-muted">{cutoffs[group.supplierOrgId]}</span> : null}
          </div>
        ))}
        <div className="mt-1.5 flex justify-between gap-2.5 border-t border-line pt-2.5 font-semibold">
          <span>Total before GST</span>
          <span className="num">{formatMoney(totalCents)}</span>
        </div>
      </div>
      <BudgetImpact weekSpentCents={weekSpentCents} totalCents={totalCents} budgetCents={budgetCents} />
      {budgetWarning ? <p className="text-[.8rem] font-semibold text-warn">{budgetWarning}</p> : null}
      {subtotals.length > 0 || blockers.length > 0 ? <CheckLine blockers={blockers} /> : null}
      <div className="hidden @min-[900px]:block">
        <PlaceButton placing={placing} disabled={disabled} onPlace={onPlace} label={placeLabel(subtotals.length, totalCents)} />
        <p className="mt-2 text-center text-[.72rem] text-muted">Stock is checked and reserved when you place the orders.</p>
      </div>
    </aside>
  );
}

/** Phone: the total and Place order stay in reach at the bottom of the screen while scrolling the cart. */
export function PlaceBar(props: Props) {
  const { subtotals, totalCents, blockers, placing, onPlace } = props;
  return (
    <div
      className={cx(
        "sticky bottom-0 z-10 -mx-1 flex flex-col gap-1.5 border-t border-line bg-bg px-1 pt-2.5 pb-2 @min-[900px]:hidden",
        "after:absolute after:inset-x-0 after:top-full after:h-9 after:bg-bg",
      )}
    >
      {blockers[0] ? <p className="text-[.8rem] font-semibold text-warn">{blockers[0]}</p> : null}
      <div className="flex items-center gap-3">
        <span className="flex flex-col">
          <span className="text-[.75rem] text-muted">Total before GST</span>
          <b className="num">{formatMoney(totalCents)}</b>
        </span>
        <PlaceButton
          placing={placing}
          disabled={!canPlace(props)}
          onPlace={onPlace}
          label={subtotals.length > 1 ? `Place ${subtotals.length} orders` : "Place order"}
          className="flex-1"
        />
      </div>
    </div>
  );
}
