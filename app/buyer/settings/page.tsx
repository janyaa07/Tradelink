import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { daysLeft } from "@/domain/restock";
import { signOut } from "@/features/auth/actions";
import { AddUsualForm } from "@/features/buyer/AddUsualForm";
import { CanDoPanel } from "@/features/buyer/CanDoPanel";
import { getBuyerCatalogue, getBuyerSettings, getOnOrder, getUsualItems } from "@/features/buyer/queries";
import { SettingsControls } from "@/features/buyer/SettingsControls";
import { UsualItemRow, type UsualRow } from "@/features/buyer/UsualItemRow";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { RecordList } from "@/ui/RecordCard";
import { ThemeSetting } from "@/ui/ThemeSetting";

export const metadata: Metadata = { title: "Settings · Tradelink" };

export default async function BuyerSettingsPage() {
  const session = await requireRole("buyer");
  const [settings, usuals, catalogue, onOrder] = await Promise.all([
    getBuyerSettings(session.orgId),
    getUsualItems(session.orgId),
    getBuyerCatalogue(),
    getOnOrder(session.orgId),
  ]);
  const byId = new Map(catalogue.map((item) => [item.id, item]));
  const rows: UsualRow[] = usuals.flatMap((usual) => {
    const item = byId.get(usual.productId);
    if (!item) return [];
    return [
      {
        productId: usual.productId,
        name: item.name,
        art: item.art,
        usualQty: usual.usualQty,
        usePerDay: usual.usePerDay,
        inShop: usual.inShop,
        daysLeft: daysLeft(usual.inShop, onOrder.get(usual.productId) ?? 0, usual.usePerDay),
      },
    ];
  });
  const usualIds = new Set(usuals.map((usual) => usual.productId));
  const addable = catalogue
    .filter((item) => !usualIds.has(item.id))
    .map((item) => ({ id: item.id, label: `${item.name} · ${item.supplierName}` }));

  return (
    <div className="flex flex-col gap-4 @container">
      <div className="flex flex-col gap-[3px]">
        <h1>Settings</h1>
        <p className="text-muted">Choose how Tradelink helps {session.orgName}.</p>
      </div>
      <Panel title="Appearance">
        <ThemeSetting />
      </Panel>
      <SettingsControls settings={settings} />
      <CanDoPanel />
      <section aria-labelledby="usuals-title" className="flex flex-col gap-2.5">
        <h2 id="usuals-title">My usual items</h2>
        {rows.length > 0 ? (
          <RecordList>
            {rows.map((row) => (
              <UsualItemRow key={row.productId} row={row} />
            ))}
          </RecordList>
        ) : (
          <p className="text-muted">You have no usual items yet. Add the products you order most.</p>
        )}
      </section>
      <AddUsualForm options={addable} />
      <Panel title="Account">
        <p className="text-[.92rem]">
          {session.fullName}
          {session.email ? <span className="block text-[.84rem] text-muted">{session.email}</span> : null}
        </p>
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </Panel>
    </div>
  );
}
