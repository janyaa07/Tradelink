import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { periodLabel } from "@/features/insights/format";
import { InsightsKpis } from "@/features/insights/InsightsKpis";
import { PriceChangesPanel } from "@/features/insights/PriceChangesPanel";
import { getInsights } from "@/features/insights/queries";
import { SupplierRecordList } from "@/features/insights/SupplierRecordList";
import { SupplierSpendPanel } from "@/features/insights/SupplierSpendPanel";
import { insightsSummary } from "@/features/insights/summary";
import { WeeklySpendChart } from "@/features/insights/WeeklySpendChart";
import { PageHeader } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Insights · Tradelink" };

export default async function BuyerInsightsPage() {
  const session = await requireRole("buyer");
  const insights = await getInsights(session.orgId, new Date());
  const summary = insightsSummary({
    spentCents: insights.spentCents,
    lastWeekCents: insights.lastWeekCents,
    budgetCents: insights.budgetCents,
    weeks: insights.weeks.length,
    bySupplier: insights.bySupplier,
    priceChangesUp: insights.priceChangesUp,
    priceChangesDown: insights.priceChangesDown,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Insights"
        description={`Your spend, suppliers and prices for the last ${insights.weeks.length} weeks, ${periodLabel(insights.weeks)}. Weeks run Monday to Sunday, Singapore time.`}
      />

      <p className="ai-tint flex items-start gap-2.5 rounded-xl px-4 py-3 text-[.875rem] leading-relaxed">
        <span aria-hidden="true" className="ai-spark mt-[3px] size-4" />
        <span>
          <b className="ai-text font-semibold">In short:</b> {summary}
        </span>
      </p>

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
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[820px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <WeeklySpendChart weeks={insights.weeks} budgetCents={insights.budgetCents} />
          <SupplierSpendPanel rows={insights.bySupplier} weeks={insights.weeks.length} />
        </div>
      </div>

      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[820px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <SupplierRecordList rows={insights.record} />
          <PriceChangesPanel changes={insights.priceChanges} total={insights.priceChangeCount} />
        </div>
      </div>
    </div>
  );
}
