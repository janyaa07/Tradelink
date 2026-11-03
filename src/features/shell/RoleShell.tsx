"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/features/auth/actions";
import { AppShell } from "@/ui/shell/AppShell";
import type { ShellRole } from "@/ui/shell/types";
import { NAV, activeHrefFor } from "./nav";

type Props = {
  role: ShellRole;
  userName: string;
  orgName: string;
  /** Counts keyed by nav href, for example { "/admin/attention": 4 }. */
  counts?: Record<string, number>;
  /** The number on the bell. For buyers: unread notifications plus alerts that need action. */
  bellCount: number;
  /** Buyers only: the number of lines in the cart. */
  cartCount?: number;
  children: ReactNode;
};

/** Wires the app shell to the current route: active tab, home layout, the bell, the cart and sign out. */
export function RoleShell({ role, userName, orgName, counts = {}, bellCount, cartCount, children }: Props) {
  const pathname = usePathname();
  const home = NAV[role][0]?.href ?? "/";
  const navItems = NAV[role].map((item) => ({ ...item, count: counts[item.href] || undefined }));
  return (
    <AppShell
      role={role}
      userName={userName}
      orgName={orgName}
      navItems={navItems}
      activeHref={activeHrefFor(role, pathname)}
      pathname={pathname}
      isHome={pathname === home}
      bell={{ href: `/${role}/notifications`, count: bellCount }}
      cart={role === "buyer" ? { href: "/buyer/cart", count: cartCount ?? 0 } : null}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
