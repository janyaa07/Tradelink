"use client";

import { useMemo } from "react";
import { plural, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, toCents } from "@/domain/money";
import { checkLines, isOverBudget, subtotalsBySupplier } from "@/domain/review";
import type { DraftLine } from "./draft";
import { lineView, type LineView } from "./line-view";
import type { OrderPageData } from "./review-types";

/** Lowers availability where the last stock check found less than the page was rendered with. */
function withStockChecks(catalogue: CatalogueItem[], short: Map<string, number>): CatalogueItem[] {
  if (short.size === 0) return catalogue;
  return catalogue.map((item) => {
    const available = short.get(item.id);
    return available === undefined || available >= item.available ? item : { ...item, available };
  });
}

/** Derives everything review shows from the lines, the catalogue and the buyer's settings. */
export function useReviewModel(lines: DraftLine[], data: OrderPageData, short: Map<string, number>) {
  const catalogue = useMemo(() => withStockChecks(data.catalogue, short), [data.catalogue, short]);
  const byId = useMemo(() => new Map(catalogue.map((item) => [item.id, item])), [catalogue]);
  const invited = useMemo(
    () => new Set(data.suppliers.filter((supplier) => supplier.status === "invited").map((supplier) => supplier.id)),
    [data.suppliers],
  );
  const lastPaid = useMemo(() => new Map(data.usuals.map((usual) => [usual.productId, usual.lastPaid])), [data.usuals]);

  return useMemo(() => {
    const check = checkLines(lines, byId);
    const context = { byId, catalogue, over: new Set(check.over), invitedSuppliers: invited, lastPaid };
    const views = new Map<string, LineView>(lines.map((line) => [line.id, lineView(line, context)]));
    const groups = subtotalsBySupplier(check.need, byId);
    const totalCents = groups.reduce((sum, group) => sum + group.totalCents, 0);
    const budgetCents = toCents(data.budget);
    const budgetWarning =
      data.budgetWarning && groups.length > 0 && isOverBudget(data.weekSpentCents, totalCents, budgetCents)
        ? `This takes your week to ${formatMoney(data.weekSpentCents + totalCents)}, above your ${formatMoney(budgetCents)} budget.`
        : null;
    const blockers = [
      check.unresolved > 0 ? `Choose a product for ${plural(check.unresolved, "line")}.` : null,
      check.over.length > 0 ? `Reduce ${plural(check.over.length, "item")} to the stock available.` : null,
    ].filter((blocker): blocker is string => blocker !== null);
    return { catalogue, byId, views, groups, totalCents, budgetWarning, blockers };
  }, [lines, byId, catalogue, invited, lastPaid, data.budget, data.budgetWarning, data.weekSpentCents]);
}
