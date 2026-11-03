import type { ReactNode } from "react";
import { BusinessLogo } from "../BusinessLogo";
import { cx } from "../cx";
import { ThemeToggle } from "../ThemeToggle";
import styles from "./AppShell.module.css";
import { Brand } from "./Brand";
import { CartBar } from "./CartBar";
import { ShellNav } from "./ShellNav";
import type { CartSummary, NavItem, ShellRole } from "./types";

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
  activeHref: string;
  /** Home pages hide the phone top bar and let HomeHero run edge to edge. */
  isHome: boolean;
  cart?: CartSummary | null;
  children: ReactNode;
};

export function AppShell({ role, userName, orgName, navItems, activeHref, isHome, cart, children }: AppShellProps) {
  const homeHref = navItems[0]?.href ?? "/";

  return (
    <div className={cx(styles.shell, isHome && styles.home, cart && styles.hasCart, "bg-bg")}>
      <a
        href="#main"
        className="sr-only z-40 rounded-md bg-accent px-3 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header
        className={cx(
          styles.top,
          "flex items-center gap-2 border-b border-line bg-surface px-3.5 py-[11px] text-ink",
          "rail:border-r rail:border-b-0 rail:px-4 rail:pt-[18px] rail:pb-3",
        )}
      >
        <Brand href={homeHref} />
        <div className="flex min-w-0 items-center gap-1.5 text-[.78rem] text-muted rail:hidden">
          <BusinessLogo name={orgName} size={24} />
          <span className="break-words">{orgName}</span>
        </div>
        <ThemeToggle />
      </header>
      <ShellNav items={navItems} activeHref={activeHref} className={styles.nav} />
      <div
        className={cx(
          styles.who,
          "items-center gap-2.5 border-r border-line bg-surface px-4 pt-3 pb-4 text-[.84rem] text-ink",
        )}
      >
        <BusinessLogo name={orgName} size={34} />
        <div className="min-w-0 break-words">
          {userName}
          <span className="block text-[.78rem] text-muted">
            {orgName} · {ROLE_LABELS[role]}
          </span>
        </div>
      </div>
      <main id="main" tabIndex={-1} className={cx(styles.main, "relative px-3.5 pt-4 pb-7 outline-none rail:p-6 rail:pb-9")}>
        {isHome ? children : <div className="mx-auto flex max-w-[1060px] flex-col gap-4">{children}</div>}
      </main>
      {cart ? <CartBar {...cart} className={styles.cart} /> : null}
    </div>
  );
}
