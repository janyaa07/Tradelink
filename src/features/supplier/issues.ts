import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import type { ButtonVariant } from "@/ui/Button";
import { orderNumber } from "@/ui/format";
import type { PillTone } from "@/ui/Pill";
import type { TodoTone } from "@/ui/TodoItem";
import { inventoryHref } from "./stock";

export const ISSUE_TYPES = ["short", "damaged", "wrong_item", "expired", "late", "invoice"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_ANSWERS = ["credit", "replace", "on_the_way", "dispute"] as const;
export type IssueAnswer = (typeof ISSUE_ANSWERS)[number];

const TYPE_LABELS: Record<IssueType, string> = {
  short: "Short",
  damaged: "Damaged",
  wrong_item: "Wrong item",
  expired: "Expired",
  late: "Late",
  invoice: "Invoice",
};

/** An open problem as the supplier sees it. Amount is a decimal string such as "12.40". */
export type IssueView = {
  id: string;
  type: IssueType;
  qty: number;
  amount: string;
  note: string | null;
  createdAt: string;
  orderNumber: number;
  buyerName: string;
  productName: string | null;
};

export const ISSUE_STATUSES = [
  "open",
  "credit_promised",
  "replacement_promised",
  "supplier_replied",
  "disputed",
  "closed",
  "credit_received",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** A problem on one order, answered or not, for the supplier's order page. */
export type OrderIssueView = IssueView & { status: IssueStatus };

/** Where a problem stands, as the supplier sees it. */
export const ISSUE_STATUS_PILLS: Record<IssueStatus, { label: string; tone: PillTone }> = {
  open: { label: "To answer", tone: "bad" },
  credit_promised: { label: "Waiting for buyer to confirm", tone: "warn" },
  replacement_promised: { label: "Replacement promised", tone: "info" },
  supplier_replied: { label: "Answered", tone: "info" },
  disputed: { label: "Disputed", tone: "plain" },
  closed: { label: "Closed", tone: "plain" },
  credit_received: { label: "Credit received", tone: "good" },
};

/** The To do title for a problem (SUP-02). */
export function issueTodoTitle(issue: Pick<IssueView, "type" | "orderNumber">): string {
  const ref = orderNumber(issue.orderNumber);
  if (issue.type === "late") return `Late delivery on ${ref}`;
  if (issue.type === "invoice") return `Invoice query on ${ref}`;
  if (issue.type === "wrong_item") return `Wrong item on ${ref}`;
  return `${TYPE_LABELS[issue.type]} item on ${ref}`;
}

/** The heading of a problem card (prototype issueCard). */
export function issueHeading(issue: Pick<IssueView, "type" | "orderNumber" | "qty" | "productName">): string {
  const ref = orderNumber(issue.orderNumber);
  if (issue.type === "invoice") return `Invoice query on ${ref}`;
  if (issue.type === "late") return `${ref} is late`;
  return `${TYPE_LABELS[issue.type]}: ${issue.qty} × ${issue.productName ?? "item"}`;
}

export type AnswerOption = { answer: IssueAnswer; label: string; variant: ButtonVariant };

/** The answers a problem allows (SUP-09). */
export function answerOptions(issue: Pick<IssueView, "type" | "amount">): AnswerOption[] {
  const options: AnswerOption[] = [];
  if (Number(issue.amount) > 0) {
    options.push({ answer: "credit", label: `Credit ${formatMoney(issue.amount)}`, variant: "primary" });
  }
  if (issue.type === "late") {
    options.push({ answer: "on_the_way", label: "It is on the way", variant: "primary" });
    return options;
  }
  if (issue.type !== "invoice") options.push({ answer: "replace", label: "Replace next delivery", variant: "default" });
  options.push({ answer: "dispute", label: issue.type === "invoice" ? "Invoice is correct" : "Dispute", variant: "danger" });
  return options;
}

export type SupplierTodo = {
  key: string;
  tone: TodoTone;
  title: string;
  detail: string;
  href: string;
  label: string;
};

type TodoProduct = Pick<CatalogueItem, "id" | "name" | "health" | "available" | "reorderLevel">;

/** Supplier To do (SUP-02): open problems, products a buyer added, then low and out-of-stock products. */
export function buildSupplierTodos(issues: IssueView[], products: TodoProduct[]): SupplierTodo[] {
  const problems = issues.map((issue) => ({
    key: `issue-${issue.id}`,
    tone: "warn" as const,
    title: issueTodoTitle(issue),
    detail: issue.note ? `${issue.buyerName}: ${issue.note}` : issue.buyerName,
    href: "/supplier/orders#problems",
    label: "Answer",
  }));
  const unconfirmed = products
    .filter((product) => product.health === "unconfirmed")
    .map((product) => ({
      key: `confirm-${product.id}`,
      tone: "warn" as const,
      title: `Confirm stock for ${product.name}`,
      detail: "A buyer added this item.",
      href: inventoryHref({ q: product.name }),
      label: "Confirm",
    }));
  const low = products
    .filter((product) => product.health === "low" || product.health === "out")
    .map((product) => {
      const out = product.health === "out";
      return {
        key: `stock-${product.id}`,
        tone: out ? ("bad" as const) : ("warn" as const),
        title: `${product.name} is ${out ? "out of stock" : "low"}`,
        detail: `${product.available} available, reorder at ${product.reorderLevel}.`,
        href: inventoryHref({ q: product.name }),
        label: "Receive stock",
      };
    });
  return [...problems, ...unconfirmed, ...low];
}
