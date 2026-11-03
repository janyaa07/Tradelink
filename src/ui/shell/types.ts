import type { IconName } from "../Icon";

export type ShellRole = "buyer" | "supplier" | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
};

export type CartSummary = {
  count: number;
  totalLabel: string;
  href: string;
};
