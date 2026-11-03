import "server-only";
import { cache } from "react";
import type { CatalogueItem } from "@/domain/catalogue";
import { cutoffText } from "@/domain/cutoff";
import { toCents, type Cents } from "@/domain/money";
import { reorderPlan, type ReorderRow } from "@/domain/reorder";
import { getBuyerCatalogue, getBuyerSettings, getDeliveryTerms, getOnOrder, getSkippedToday, getUsualItems } from "./queries";

export type PlanRow = ReorderRow & { item: CatalogueItem; inShop: number; usePerDay: number };

export type ReorderPlanView = {
  rows: PlanRow[];
  totalCents: Cents;
  /** "{supplier}: Order by 16:00 for tomorrow", one per supplier in the plan. */
  cutoffLines: string[];
};

/** Ready for tomorrow for the buyer's business (BUY-08), from real usual items, orders and stock. */
export const getReorderPlan = cache(async (orgId: string): Promise<ReorderPlanView> => {
  const [settings, usuals, catalogue, onOrder, skipped] = await Promise.all([
    getBuyerSettings(orgId),
    getUsualItems(orgId),
    getBuyerCatalogue(),
    getOnOrder(orgId),
    getSkippedToday(orgId),
  ]);
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const visible = usuals.filter((usual) => byId.has(usual.productId));
  const plan = reorderPlan(
    visible.map((usual) => ({
      productId: usual.productId,
      inShop: usual.inShop,
      usePerDay: usual.usePerDay,
      onOrder: onOrder.get(usual.productId) ?? 0,
      available: Math.max(0, byId.get(usual.productId)?.available ?? 0),
      skippedToday: skipped.has(usual.productId),
    })),
    settings.suggestReorder,
  );
  const usualById = new Map(visible.map((usual) => [usual.productId, usual]));
  const rows = plan.flatMap((row) => {
    const item = byId.get(row.productId);
    const usual = usualById.get(row.productId);
    return item && usual ? [{ ...row, item, inShop: usual.inShop, usePerDay: usual.usePerDay }] : [];
  });

  const suppliers = [...new Map(rows.map((row) => [row.item.supplierOrgId, row.item.supplierName]))];
  const terms = await getDeliveryTerms(suppliers.map(([id]) => id));
  const now = new Date();
  const cutoffLines = suppliers.map(([id, name]) => {
    const supplierTerms = terms.get(id);
    return supplierTerms ? `${name}: ${cutoffText(supplierTerms, now)}` : name;
  });

  return {
    rows,
    totalCents: rows.reduce((sum, row) => sum + toCents(row.item.price) * row.qty, 0),
    cutoffLines,
  };
});
