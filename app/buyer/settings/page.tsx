import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AddUsualForm } from "@/features/buyer/AddUsualForm";
import { getBuyerCatalogue, getBuyerSettings, getConnectedSuppliers, getOnOrder, getUsualItems } from "@/features/buyer/queries";
import { AlertSwitches, BudgetForm } from "@/features/buyer/SettingsControls";
import { UsualList, type UsualRow } from "@/features/buyer/UsualItemRow";
import { SettingsCard } from "@/features/settings/SettingsCard";
import { AccountCard, AppearanceCard, SettingsLayout, type SettingsNavGroup } from "@/features/settings/SettingsParts";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Pill } from "@/ui/Pill";

export const metadata: Metadata = { title: "Settings · Tradelink" };

const NAV: SettingsNavGroup[] = [
  {
    label: "Shop",
    items: [
      { id: "budget", label: "Budget and alerts" },
      { id: "usuals", label: "Usual items" },
      { id: "suppliers", label: "Suppliers" },
    ],
  },
  {
    label: "You",
    items: [
      { id: "account", label: "Account" },
      { id: "appearance", label: "Appearance" },
    ],
  },
];

export default async function BuyerSettingsPage() {
  const session = await requireRole("buyer");
  const [settings, usuals, catalogue, onOrder, suppliers] = await Promise.all([
    getBuyerSettings(session.orgId),
    getUsualItems(session.orgId),
    getBuyerCatalogue(),
    getOnOrder(session.orgId),
    getConnectedSuppliers(session.orgId),
  ]);
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const rows: UsualRow[] = usuals.flatMap((usual) => {
    const item = byId.get(usual.productId);
    if (!item) return [];
    return [
      {
        productId: usual.productId,
        name: item.name,
        supplierName: item.supplierName,
        art: item.art,
        usualQty: usual.usualQty,
        usePerDay: usual.usePerDay,
        inShop: usual.inShop,
        onOrder: onOrder.get(usual.productId) ?? 0,
      },
    ];
  });
  const usualIds = new Set(usuals.map((usual) => usual.productId));
  const addable = catalogue.filter((item) => !usualIds.has(item.id)).map((item) => ({ id: item.id, label: `${item.name} · ${item.supplierName}` }));

  return (
    <SettingsLayout description={`${session.orgName} · ${session.fullName}`} nav={NAV}>
      <SettingsCard
        id="budget"
        title="Budget and alerts"
        description="How Tradelink AI and Home warn you about spend and prices. Shared by everyone at your business."
      >
        <BudgetForm settings={settings} />
        <AlertSwitches settings={settings} />
      </SettingsCard>

      <SettingsCard
        id="usuals"
        title="Usual items"
        description="What you order most. Tradelink uses these numbers for My usual and Ready for tomorrow."
      >
        {rows.length > 0 ? (
          <UsualList rows={rows} />
        ) : (
          <p className="border-t border-line px-4 py-3.5 text-[.875rem] text-muted rail:px-[18px]">
            You have no usual items yet. Add the products you order most.
          </p>
        )}
        <AddUsualForm options={addable} />
      </SettingsCard>

      <SettingsCard id="suppliers" title="Suppliers" description="The suppliers you can order from.">
        {suppliers.length > 0 ? (
          <ul>
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[.875rem] rail:px-[18px]">
                <BusinessLogo name={supplier.name} seedKey={supplier.id} size={28} />
                <span className="min-w-0 flex-1 break-words font-medium">{supplier.name}</span>
                {supplier.status === "invited" ? <Pill tone="warn">Invited</Pill> : <Pill tone="good">Connected</Pill>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-line px-4 py-3.5 text-[.875rem] text-muted rail:px-[18px]">No suppliers connected yet.</p>
        )}
      </SettingsCard>

      <AccountCard
        orgName={session.orgName}
        fullName={session.fullName}
        rows={[
          ["Name", session.fullName],
          ["Email", session.email ?? "Not given"],
          ["Business", session.orgName],
          ["Role", "Buyer"],
        ]}
      />
      <AppearanceCard />
    </SettingsLayout>
  );
}
