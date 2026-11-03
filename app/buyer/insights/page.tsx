import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { periodLabel } from "@/features/insights/format";
import { InsightsKpis } from "@/features/insights/InsightsKpis";
import { PriceChangesPanel } from "@/features/insights/PriceChangesPanel";
import { getInsights } from "@/features/insights/queries";
import { SupplierRecordList } from "@/features/insights/SupplierRecordList";
import { SupplierSpendPanel } from "@/features/insights/SupplierSpendPanel";
import { WeeklySpendChart } from "@/features/insights/WeeklySpendChart";

export const metadata: Metadata = { title: "Insights · Tradelink" };

export default async function BuyerInsightsPage() {
  const session = await requireRole("buyer");
  const insights = await getInsights(session.orgId, new Date());

  return (
    <>
      <div className="flex flex-col gap-[3px]">
        <h1>Insights</h1>
        <p className="text-muted">
          Last {insights.weeks.length} weeks, {periodLabel(insights.weeks)}. Weeks run Monday to Sunday, Singapore time
          (SGT).
        </p>
      </div>

      <InsightsKpis
        spentCents={insights.spentCents}
        lastWeekCents={insights.lastWeekCents}
        budgetCents={insights.budgetCents}
        leftCents={insights.leftCents}
        caughtCents={insights.caughtCents}
        priceChangeCount={insights.priceChangeCount}
        priceChangesUp={insights.priceChangesUp}
        priceChangesDown={insights.priceChangesDown}
      />

      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[820px]:grid-cols-2">
          <WeeklySpendChart weeks={insights.weeks} budgetCents={insights.budgetCents} />
          <SupplierSpendPanel rows={insights.bySupplier} weeks={insights.weeks.length} />
        </div>
      </div>

      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[820px]:grid-cols-2">
          <SupplierRecordList rows={insights.record} />
          <PriceChangesPanel changes={insights.priceChanges} total={insights.priceChangeCount} />
        </div>
      </div>
    </>
  );
}
