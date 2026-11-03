import type { ReactNode } from "react";
import { cx } from "../cx";
import { ThemeToggle } from "../ThemeToggle";
import { AlertsPopover } from "./AlertsPopover";
import styles from "./AppShell.module.css";
import { Brand } from "./Brand";
import { ShellNav } from "./ShellNav";
import { TopBarLink } from "./TopBarLink";
import { TopNav } from "./TopNav";
import type { NavItem, ShellLink, ShellRole } from "./types";
import { UserMenu } from "./UserMenu";

const ROLE_LABELS: Record<ShellRole, string> = {
  buyer: "Buyer",
  supplier: "Supplier",
  admin: "Admin",
};

export type AppShellProps = {
  role: ShellRole;
  userName: string;
  orgName: string;
  navItems: NavItem[];
  /** The nav item for the current page, or "" when the page is not in the nav. */
  activeHref: string;
  pathname: string;
  /** The bell: notifications plus anything that needs action. */
  bell: ShellLink;
  /** When given, the bell opens these alerts in a pop-up instead of linking to the alerts page. */
  bellPanel?: ReactNode;
  /** The buyer's cart; other roles have none. */
  cart?: ShellLink | null;
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({
  role,
  userName,
  orgName,
  navItems,
  activeHref,
  pathname,
  bell,
  bellPanel,
  cart,
  signOutAction,
  children,
}: AppShellProps) {
  const homeHref = navItems[0]?.href ?? "/";
  const roleLabel = ROLE_LABELS[role];
  const settingsHref = `/${role}/settings`;

  // No side rail: from 760px the section titles sit in the top bar on every page but Home, whose
  // tiles already lead to them. Phone keeps the bottom tabs. Settings is in the account menu.
  return (
    <div className={cx(styles.shell, "bg-bg")}>
      <a
        href="#main"
        className="sr-only z-40 rounded-md bg-accent px-3 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header
        className={cx(
          styles.top,
          "z-20 flex items-center gap-2 border-b border-line bg-surface px-3.5 py-2.5 text-ink rail:px-8 rail:py-3",
        )}
      >
        <Brand href={homeHref} />
        <TopNav items={navItems} activeHref={activeHref} />
        <span className="flex-1" />
        <ThemeToggle />
        {bellPanel ? (
          <AlertsPopover count={bell.count}>{bellPanel}</AlertsPopover>
        ) : (
          <TopBarLink
            href={bell.href}
            icon="bell"
            label="Alerts"
            countLabel="new"
            count={bell.count}
            current={pathname === bell.href}
          />
        )}
        {cart ? (
          <TopBarLink
            href={cart.href}
            icon="cart"
            label="Cart"
            countLabel={cart.count === 1 ? "line" : "lines"}
            count={cart.count}
            current={pathname === cart.href}
          />
        ) : null}
        <UserMenu
          userName={userName}
          orgName={orgName}
          roleLabel={roleLabel}
          settingsHref={settingsHref}
          signOutAction={signOutAction}
        />
      </header>
      <ShellNav items={navItems} activeHref={activeHref} className={styles.nav} />
      <main id="main" tabIndex={-1} className={cx(styles.main, "relative px-4 pt-5 pb-8 outline-none rail:px-8 rail:pt-8 rail:pb-12")}>
        <div className="mx-auto flex max-w-[1080px] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
