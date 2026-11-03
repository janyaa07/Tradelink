import { formatMoney } from "@/domain/money";
import { replyText } from "@/domain/todos";
import type { PillTone } from "@/ui/Pill";
import { ISSUE_TYPE_LABELS, type ProblemType } from "../problem";

export const ISSUE_TYPES = ["short", "damaged", "wrong_item", "expired", "late", "invoice"] as const;
export type IssueType = ProblemType | "late" | "invoice";

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

/** What a summary needs to know about one reported problem. */
export type IssueFacts = {
  type: IssueType;
  status: IssueStatus;
  qty: number;
  /** Money as "8.40". */
  amount: string;
  productName: string | null;
  supplierName: string;
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "3 items" and the first two item names, for a compact order row. */
export function itemSummary(names: string[]): { count: string; names: string } {
  return { count: plural(names.length, "item", "items"), names: names.slice(0, 2).join(", ") };
}

/** "Short: 2 × Dried noodles", "Late: not here yet" or "Invoice query". */
export function problemTitle(issue: Pick<IssueFacts, "type" | "qty" | "productName">): string {
  if (issue.type === "late") return "Late: not here yet";
  if (issue.type === "invoice") return "Invoice query";
  return `${ISSUE_TYPE_LABELS[issue.type]}: ${issue.qty} × ${issue.productName ?? "an item"}`;
}

/** Where the problem stands, in a few words: "waiting for Harbour Dry Goods". */
export function problemProgress(issue: Pick<IssueFacts, "status" | "amount" | "supplierName">): string {
  switch (issue.status) {
    case "open":
      return `waiting for ${issue.supplierName}`;
    case "credit_promised":
      return `${issue.supplierName} will credit ${formatMoney(issue.amount)}`;
    case "replacement_promised":
      return `${issue.supplierName} will replace it on the next delivery`;
    case "supplier_replied":
      return `${issue.supplierName} says it is on the way`;
    case "disputed":
      return "Tradelink is reviewing it";
    case "closed":
      return "closed with no credit";
    case "credit_received":
      return `credit of ${formatMoney(issue.amount)} received`;
  }
}

/** One line for a row in the Problems filter: "Short: 2 × Dried noodles · waiting for Harbour Dry Goods". */
export function problemSummary(issue: IssueFacts): string {
  return `${problemTitle(issue)} · ${problemProgress(issue)}`;
}

/** The supplier's answer as a sentence, for the order's problems section. */
export function issueAnswer(issue: Pick<IssueFacts, "status" | "amount" | "supplierName">): string {
  if (issue.status === "open") return `Waiting for ${issue.supplierName} to answer.`;
  if (issue.status === "credit_received") return `${issue.supplierName} credited ${formatMoney(issue.amount)}. You marked it received.`;
  return replyText(issue.status, issue.supplierName, issue.amount) ?? "";
}

export const ISSUE_STATUS_PILLS: Record<IssueStatus, { label: string; tone: PillTone }> = {
  open: { label: "Waiting", tone: "warn" },
  credit_promised: { label: "Credit promised", tone: "good" },
  replacement_promised: { label: "Replacement promised", tone: "info" },
  supplier_replied: { label: "Supplier replied", tone: "info" },
  disputed: { label: "Under review", tone: "bad" },
  closed: { label: "Closed", tone: "plain" },
  credit_received: { label: "Credit received", tone: "good" },
};

/** The slim banner above the list: "2 problems waiting for the supplier". */
export function waitingBanner(open: number): string {
  return `${plural(open, "problem", "problems")} waiting for the supplier`;
}
