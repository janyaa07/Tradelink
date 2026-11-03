import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { PriceChangesPanel } from "@/features/insights/PriceChangesPanel";
import { getInsights } from "@/features/insights/queries";
import { SupplierRecordList } from "@/features/insights/SupplierRecordList";
import { SupplierSpendPanel } from "@/features/insights/SupplierSpendPanel";
import { WeeklySpendChart } from "@/features/insights/WeeklySpendChart";
import { Tiles } from "@/ui/Tiles";

export const metadata: Metadata = { title: "Insights · Tradelink" };

export default async function BuyerInsightsPage() {
  const session = await requireRole("buyer");
  const insights = await getInsights(session.orgId, new Date());

  return (
    <>
      <div className="flex flex-col gap-[3px]">
        <h1>Insights</h1>
        <p className="text-muted">Facts from your own orders, deliveries and credits.</p>
      </div>
      <Tiles
        items={[
          { label: "Spent this week", value: formatMoney(insights.spentCents) },
          {
            label: `Left of ${formatMoney(insights.budgetCents)} budget`,
            value: formatMoney(insights.leftCents),
            alert: insights.overBudget,
          },
          { label: "Overcharges caught", value: formatMoney(insights.caughtCents) },
          { label: "Price changes", value: insights.priceChangeCount },
        ]}
      />
      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 @min-[860px]:grid-cols-2">
          <WeeklySpendChart weeks={insights.weeks} budgetCents={insights.budgetCents} />
          <SupplierSpendPanel rows={insights.bySupplier} />
        </div>
      </div>
      <SupplierRecordList rows={insights.record} />
      <PriceChangesPanel changes={insights.priceChanges} total={insights.priceChangeCount} />
    </>
  );
}
