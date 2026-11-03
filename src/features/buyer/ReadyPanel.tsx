import { plural } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { formatDaysLeft } from "@/domain/restock";
import { Panel } from "@/ui/Panel";
import { ProductArt } from "@/ui/ProductArt";
import { PlanActions } from "./PlanActions";
import type { RestockPlanView } from "./restock-plan";

/** Ready for tomorrow: usual items running low, with quantities for a week and cut-offs (BUY-08). */
export function ReadyPanel({ plan }: { plan: RestockPlanView }) {
  const hasPlan = plan.rows.length > 0;
  return (
    <Panel title="Ready for tomorrow" action={hasPlan ? <b className="tabular-nums">{formatMoney(plan.totalCents)}</b> : undefined}>
      {hasPlan ? (
        <>
          <ul>
            {plan.rows.map((row) => (
              <li key={row.productId} className="flex items-center gap-2.5 border-b border-line py-[7px] last:border-b-0">
                <ProductArt kind={row.item.art} size={42} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[.84rem]">{row.item.name}</b>
                  <span className="text-[.84rem] text-muted">
                    {formatDaysLeft(row.daysLeft)} days left
                    {row.qty < row.want ? `, only ${row.qty} available` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap text-[.84rem] tabular-nums">{plural(row.qty, row.item.unit)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-0.5">
            {plan.cutoffLines.map((line) => (
              <p key={line} className="text-[.84rem] text-muted">
                {line}
              </p>
            ))}
          </div>
          <PlanActions />
        </>
      ) : (
        <p className="text-muted">You have enough stock for the next few days.</p>
      )}
    </Panel>
  );
}
