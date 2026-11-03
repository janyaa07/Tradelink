import { budgetUse, changeDirection, percentChange } from "@/domain/insights";
import { formatMoney, type Cents } from "@/domain/money";
import { formatPercent } from "./format";

export type SummaryFacts = {
  spentCents: Cents;
  lastWeekCents: Cents;
  budgetCents: Cents;
  weeks: number;
  /** Spend per supplier over the weeks shown, largest first. */
  bySupplier: { id: string | null; name: string; percent: number }[];
  priceChangesUp: number;
  priceChangesDown: number;
};

function budgetSentence(facts: SummaryFacts): string {
  const use = budgetUse(facts.budgetCents, facts.spentCents);
  if (use?.level === "bad") return `This week is ${formatMoney(facts.spentCents - facts.budgetCents)} over the budget.`;
  if (use?.level === "warn") return `This week has used ${use.percent}% of the budget, so it is getting close.`;
  if (use) return `Spend is on track for the budget, ${use.percent}% used this week.`;
  const percent = percentChange(facts.lastWeekCents, facts.spentCents);
  const direction = changeDirection(facts.lastWeekCents, facts.spentCents);
  if (percent === null || direction === "same") return `You spent ${formatMoney(facts.spentCents)} this week.`;
  return `You spent ${formatMoney(facts.spentCents)} this week, ${formatPercent(percent)} ${direction === "up" ? "more" : "less"} than last week.`;
}

function supplierSentence(facts: SummaryFacts): string | null {
  const [top] = facts.bySupplier;
  if (!top || top.id === null || facts.bySupplier.length < 2 || top.percent < 40) return null;
  return `${top.name} is ${top.percent}% of your spend over the last ${facts.weeks} weeks.`;
}

function priceSentence(facts: SummaryFacts): string | null {
  const { priceChangesUp: up, priceChangesDown: down } = facts;
  if (up === 0 && down === 0) return null;
  const parts = [up > 0 ? `${up} went up` : null, down > 0 ? `${down} came down` : null].filter(Boolean);
  return `On your usual items, ${parts.join(" and ")} in price.`;
}

/** The "In short" line on Insights: budget, the biggest supplier and price moves, in plain sentences. */
export function insightsSummary(facts: SummaryFacts): string {
  return [budgetSentence(facts), supplierSentence(facts), priceSentence(facts)].filter(Boolean).join(" ");
}
