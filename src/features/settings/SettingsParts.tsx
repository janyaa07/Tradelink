import type { ReactNode } from "react";
import { signOut } from "@/features/auth/actions";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { PageHeader } from "@/ui/PageHeader";
import { ThemeSetting } from "@/ui/ThemeSetting";
import { SettingFacts, SettingRow, SettingsCard } from "./SettingsCard";

/**
 * Settings look the same for every role: a side menu on a laptop (a row of links on a phone)
 * and the sections on the right, each one card of labelled rows.
 */

export type SettingsNavGroup = { label: string; items: { id: string; label: string }[] };

type SettingsLayoutProps = {
  description: string;
  nav: SettingsNavGroup[];
  children: ReactNode;
};

export function SettingsLayout({ description, nav, children }: SettingsLayoutProps) {
  const items = nav.flatMap((group) => group.items);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description={description} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 rail:grid-cols-[180px_minmax(0,1fr)] rail:gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="rail:sticky rail:top-4">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 rail:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex-none">
                <a
                  href={`#${item.id}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-line bg-surface px-3 text-[.8rem] font-medium whitespace-nowrap text-ink no-underline hover:border-accent"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden flex-col gap-3.5 rail:flex">
            {nav.map((group) => (
              <div key={group.label} className="flex flex-col">
                <p className="mx-2.5 mb-1 text-[.72rem] font-semibold text-muted">{group.label}</p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block rounded-md px-2.5 py-1.5 text-[.84rem] text-ink no-underline transition-colors duration-150 hover:bg-sunken"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

type AccountCardProps = {
  /** The business, for the logo beside the person's name. */
  orgName: string;
  fullName: string;
  rows: [label: string, value: ReactNode][];
};

/** Who is signed in, with Sign out. */
export function AccountCard({ orgName, fullName, rows }: AccountCardProps) {
  return (
    <SettingsCard
      id="account"
      title="Account"
      description={
        <span className="inline-flex items-center gap-2">
          <BusinessLogo name={orgName} size={20} />
          {fullName}
        </span>
      }
      action={
        <form action={signOut}>
          <Button type="submit" size="small">
            Sign out
          </Button>
        </form>
      }
    >
      <SettingFacts rows={rows} />
    </SettingsCard>
  );
}

/** System, Light or Dark, for every role. */
export function AppearanceCard() {
  return (
    <SettingsCard id="appearance" title="Appearance">
      <SettingRow label="Theme" hint="Follows your device unless you choose">
        <ThemeSetting />
      </SettingRow>
    </SettingsCard>
  );
}
