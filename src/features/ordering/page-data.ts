import "server-only";
import type { Session } from "@/data/session";
import { cutoffText } from "@/domain/cutoff";
import {
  getBuyerCatalogue,
  getBuyerSettings,
  getConnectedSuppliers,
  getDeliveryTerms,
  getUsualItems,
  getWeekSpendCents,
} from "@/features/buyer/queries";
import { getDraft } from "./queries";
import type { CartPageData } from "./cart-types";

/** Reads the draft, catalogue, usuals, suppliers, cut-offs and budget for the cart. */
export async function getCartPageData(session: Session): Promise<CartPageData> {
  const [draft, catalogue, usuals, suppliers, settings, weekSpentCents] = await Promise.all([
    getDraft(session.userId),
    getBuyerCatalogue(),
    getUsualItems(session.orgId),
    getConnectedSuppliers(session.orgId),
    getBuyerSettings(session.orgId),
    getWeekSpendCents(session.orgId),
  ]);
  const supplierIds = [...new Set([...suppliers.map((supplier) => supplier.id), ...catalogue.map((item) => item.supplierOrgId)])];
  const terms = await getDeliveryTerms(supplierIds);
  const now = new Date();
  const cutoffs = Object.fromEntries([...terms].map(([id, supplierTerms]) => [id, cutoffText(supplierTerms, now)]));
  return {
    draft,
    catalogue,
    usuals: usuals.map((usual) => ({ productId: usual.productId, lastPaid: usual.lastPaid })),
    suppliers,
    cutoffs,
    weekSpentCents,
    budget: settings.weeklyBudget,
    budgetWarning: settings.budgetWarning,
  };
}
