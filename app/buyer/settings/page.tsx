import type { Metadata } from "next";
import { requireRole, type Session } from "@/data/session";
import { signOut } from "@/features/auth/actions";
import { AddUsualForm } from "@/features/buyer/AddUsualForm";
import { getBuyerCatalogue, getBuyerSettings, getOnOrder, getUsualItems } from "@/features/buyer/queries";
import { AlertSwitches, BudgetForm } from "@/features/buyer/SettingsControls";
import { UsualList, type UsualRow } from "@/features/buyer/UsualItemRow";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { Segmented } from "@/ui/Segmented";

export const metadata: Metadata = { title: "Settings · Tradelink" };

type Tab = "app" | "shop";

function AccountPanel({ session }: { session: Session }) {
  return (
    <Panel title="Account">
      <div className="flex items-center gap-3">
        <BusinessLogo name={session.orgName} size={44} />
        <dl className="min-w-0 text-[.925rem]">
          <dt className="sr-only">Name</dt>
          <dd className="break-words font-semibold">{session.fullName}</dd>
          {session.email ? (
            <>
              <dt className="sr-only">Email</dt>
              <dd className="break-words text-muted">{session.email}</dd>
            </>
          ) : null}
          <dt className="sr-only">Business</dt>
          <dd className="break-words text-[.84rem] text-muted">{session.orgName}</dd>
        </dl>
      </div>
      <form action={signOut} className="border-t border-line pt-3">
        <Button type="submit">Sign out</Button>
      </form>
    </Panel>
  );
}

async function ShopSettings({ orgId }: { orgId: string }) {
  const [settings, usuals, catalogue, onOrder] = await Promise.all([
    getBuyerSettings(orgId),
    getUsualItems(orgId),
    getBuyerCatalogue(),
    getOnOrder(orgId),
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
  const addable = catalogue
    .filter((item) => !usualIds.has(item.id))
    .map((item) => ({ id: item.id, label: `${item.name} · ${item.supplierName}` }));

  return (
    <>
      <BudgetForm settings={settings} />
      <section aria-labelledby="usuals-title" className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h2 id="usuals-title">Usual items</h2>
          <p className="text-[.875rem] text-muted">
            What you order most. Tradelink uses these numbers for My usual and Ready for tomorrow.
          </p>
        </div>
        {rows.length > 0 ? (
          <UsualList rows={rows} />
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-muted">
            You have no usual items yet. Add the products you order most.
          </p>
        )}
        <AddUsualForm options={addable} />
      </section>
    </>
  );
}

async function AppSettings({ session }: { session: Session }) {
  const settings = await getBuyerSettings(session.orgId);
  return (
    <>
      <AccountPanel session={session} />
      <AlertSwitches settings={settings} />
    </>
  );
}

export default async function BuyerSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireRole("buyer");
  const tab: Tab = (await searchParams).tab === "shop" ? "shop" : "app";

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>Settings</h1>
        <p className="text-muted">
          {tab === "app" ? "Your account and the alerts you get." : `Budget and usual items for ${session.orgName}.`}
        </p>
      </div>
      <div>
        <Segmented
          label="Settings sections"
          items={[
            { href: "/buyer/settings?tab=app", label: "App settings", current: tab === "app" },
            { href: "/buyer/settings?tab=shop", label: "Shop settings", current: tab === "shop" },
          ]}
        />
      </div>
      {tab === "app" ? <AppSettings session={session} /> : <ShopSettings orgId={session.orgId} />}
    </>
  );
}
