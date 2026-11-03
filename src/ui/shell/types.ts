import type { IconName } from "../Icon";

export type ShellRole = "buyer" | "supplier" | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
};

/** The buyer's cart: the number of draft lines and their total. The shell shows the count on the cart icon. */
export type CartSummary = {
  count: number;
  totalLabel: string;
  href: string;
};

/** A top-bar icon link with a count badge, such as the bell or the cart. */
export type ShellLink = {
  href: string;
  count: number;
};
