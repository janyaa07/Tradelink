import type { PillTone } from "@/ui/Pill";

export type NotificationRole = "buyer" | "supplier" | "admin";

const BAD_KINDS = new Set(["Dispute opened", "Bank details changed", "Invitation declined", "Order rejected", "Supplier suspended"]);
const GOOD_KINDS = new Set(["Invitation accepted", "Order delivered", "Order accepted"]);

export function toneOf(kind: string): PillTone {
  if (BAD_KINDS.has(kind)) return "bad";
  if (GOOD_KINDS.has(kind)) return "good";
  return "info";
}

/**
 * Database notifications carry role-neutral links such as /orders/{id}; map them to the
 * signed-in role's routes. Buyers and suppliers have a page per order.
 */
export function routeFor(role: NotificationRole, link: string): string {
  const [, section, id] = link.split("/");
  if (section === "orders" && id && role !== "admin") return `/${role}/orders/${id}`;
  if (section === "orders" || section === "issues") return `/${role}/orders`;
  if (section === "inventory") return role === "supplier" ? "/supplier/inventory" : `/${role}`;
  if (section === "suppliers" && id) return role === "admin" ? `/admin/suppliers/${id}` : `/${role}`;
  if (section === "buyers" && id) return role === "admin" ? `/admin/users/buyers/${id}` : `/${role}`;
  return `/${role}`;
}

/** What a notification asks the person to do: the button's words, and where on the page it lands. */
export function actionFor(role: NotificationRole, note: { kind: string; title: string }): { label: string; hash: string } {
  switch (note.kind) {
    case "Message":
      return { label: "Reply", hash: "#messages" };
    case "Date change":
      return note.title.includes(" asks to move ") ? { label: "Answer", hash: "#messages" } : { label: "View order", hash: "#messages" };
    case "New order":
      return { label: role === "supplier" ? "Review order" : "View order", hash: "" };
    case "Order delivered":
      return { label: role === "buyer" ? "Check delivery" : "View order", hash: "" };
    case "Order part accepted":
      return { label: "See changes", hash: "" };
    case "Problem reported":
      return { label: "Answer", hash: "#problems" };
    default:
      return { label: "Open", hash: "" };
  }
}
