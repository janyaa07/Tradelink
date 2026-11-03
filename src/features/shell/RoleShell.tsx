"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/ui/shell/AppShell";
import type { CartSummary, ShellRole } from "@/ui/shell/types";
import { NAV, activeHrefFor } from "./nav";

type Props = {
  role: ShellRole;
  userName: string;
  orgName: string;
  /** Counts keyed by nav href, for example { "/admin/attention": 4 }. */
  counts?: Record<string, number>;
  cart?: CartSummary | null;
  children: ReactNode;
};

/** Wires the app shell to the current route: active tab, home layout and the cart bar. */
export function RoleShell({ role, userName, orgName, counts = {}, cart, children }: Props) {
  const pathname = usePathname();
  const home = NAV[role][0]?.href ?? "/";
  const navItems = NAV[role].map((item) => ({ ...item, count: counts[item.href] || undefined }));
  const onReview = pathname.startsWith("/buyer/order");
  return (
    <AppShell
      role={role}
      userName={userName}
      orgName={orgName}
      navItems={navItems}
      activeHref={activeHrefFor(role, pathname)}
      isHome={pathname === home}
      cart={onReview ? null : cart}
    >
      {children}
    </AppShell>
  );
}
