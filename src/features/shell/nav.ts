import type { NavItem, ShellRole } from "@/ui/shell/types";

/**
 * Navigation for each role: the top bar on laptop, bottom tabs on phone (the first four plus More
 * when there are more than five). Alerts are reached from the bell and Settings from the account
 * menu, so no role has either item.
 */
export const NAV: Record<ShellRole, NavItem[]> = {
  buyer: [
    { href: "/buyer", label: "Home", icon: "home" },
    { href: "/buyer/assistant", label: "Tradelink AI", icon: "chat" },
    { href: "/buyer/orders", label: "Orders", icon: "list" },
    { href: "/buyer/products", label: "Products", icon: "box" },
    { href: "/buyer/insights", label: "Insights", icon: "trend" },
  ],
  supplier: [
    { href: "/supplier", label: "Home", icon: "home" },
    { href: "/supplier/assistant", label: "Tradelink AI", icon: "chat" },
    { href: "/supplier/orders", label: "Orders", icon: "list" },
    { href: "/supplier/inventory", label: "Inventory", icon: "stock", also: ["/supplier/stock-history"] },
    { href: "/supplier/activity", label: "Activity", icon: "pulse" },
  ],
  admin: [
    { href: "/admin", label: "Home", icon: "home" },
    { href: "/admin/attention", label: "Attention", icon: "flag" },
    { href: "/admin/orders", label: "Orders", icon: "list" },
    { href: "/admin/suppliers", label: "Suppliers", icon: "crate" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/operators", label: "Operators", icon: "headset" },
    { href: "/admin/audit", label: "Audit log", icon: "shield" },
  ],
};

/**
 * The nav item a path belongs to: the longest matching href. Home matches only itself, so pages
 * outside the nav, such as the cart or alerts, highlight nothing ("").
 */
export function activeHrefFor(role: ShellRole, pathname: string): string {
  const [home, ...sections] = NAV[role];
  if (home && pathname === home.href) return home.href;
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const matches = sections.filter((item) => under(item.href) || (item.also ?? []).some(under));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
}
