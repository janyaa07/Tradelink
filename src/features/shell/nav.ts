import type { NavItem, ShellRole } from "@/ui/shell/types";

/** Navigation for each role, in prototype order. The first four show as bottom tabs on phone. */
export const NAV: Record<ShellRole, NavItem[]> = {
  buyer: [
    { href: "/buyer", label: "Home", icon: "home" },
    { href: "/buyer/order", label: "Order", icon: "order" },
    { href: "/buyer/ask", label: "Ask", icon: "chat" },
    { href: "/buyer/orders", label: "Orders", icon: "list" },
    { href: "/buyer/insights", label: "Insights", icon: "trend" },
    { href: "/buyer/availability", label: "Availability", icon: "stock" },
    { href: "/buyer/notifications", label: "Alerts", icon: "bell" },
    { href: "/buyer/settings", label: "Settings", icon: "gear" },
  ],
  supplier: [
    { href: "/supplier", label: "Home", icon: "home" },
    { href: "/supplier/orders", label: "Orders", icon: "list" },
    { href: "/supplier/inventory", label: "Inventory", icon: "stock" },
    { href: "/supplier/activity", label: "Activity", icon: "pulse" },
    { href: "/supplier/stock-history", label: "Stock history", icon: "history" },
    { href: "/supplier/notifications", label: "Alerts", icon: "bell" },
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

/** The nav item a path belongs to: the longest matching href. */
export function activeHrefFor(role: ShellRole, pathname: string): string {
  const matches = NAV[role].filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? NAV[role][0]?.href ?? "/";
}
