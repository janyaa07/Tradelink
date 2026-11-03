import type { NavItem, ShellRole } from "@/ui/shell/types";

/**
 * Navigation for each role. The first four show as bottom tabs on phone, the rest under More.
 * Alerts are reached from the bell in the top bar, so buyers and suppliers have no Alerts item.
 */
export const NAV: Record<ShellRole, NavItem[]> = {
  buyer: [
    { href: "/buyer", label: "Home", icon: "home" },
    { href: "/buyer/assistant", label: "Assistant", icon: "chat" },
    { href: "/buyer/orders", label: "Orders", icon: "list" },
    { href: "/buyer/products", label: "Products", icon: "box" },
    { href: "/buyer/insights", label: "Insights", icon: "trend" },
    { href: "/buyer/settings", label: "Settings", icon: "gear" },
  ],
  supplier: [
    { href: "/supplier", label: "Home", icon: "home" },
    { href: "/supplier/orders", label: "Orders", icon: "list" },
    { href: "/supplier/inventory", label: "Inventory", icon: "stock" },
    { href: "/supplier/activity", label: "Activity", icon: "pulse" },
    { href: "/supplier/stock-history", label: "Stock history", icon: "history" },
    { href: "/supplier/settings", label: "Settings", icon: "gear" },
  ],
  admin: [
    { href: "/admin", label: "Home", icon: "home" },
    { href: "/admin/attention", label: "Attention", icon: "flag" },
    { href: "/admin/orders", label: "Orders", icon: "list" },
    { href: "/admin/suppliers", label: "Suppliers", icon: "crate" },
    { href: "/admin/notifications", label: "Notifications", icon: "bell" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/operators", label: "Operators", icon: "headset" },
    { href: "/admin/audit", label: "Audit log", icon: "shield" },
    { href: "/admin/settings", label: "Settings", icon: "gear" },
  ],
};

/**
 * The nav item a path belongs to: the longest matching href. Home matches only itself, so pages
 * outside the nav, such as the cart or alerts, highlight nothing ("").
 */
export function activeHrefFor(role: ShellRole, pathname: string): string {
  const [home, ...sections] = NAV[role];
  if (home && pathname === home.href) return home.href;
  const matches = sections.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
}
