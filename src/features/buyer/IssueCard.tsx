import { formatDateTime } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { ISSUE_TYPE_LABELS } from "./problem";
import type { OpenIssue } from "./todo-queries";

function titleOf(issue: OpenIssue): string {
  if (issue.type === "invoice") return `Invoice query on ${issue.orderRef}`;
  if (issue.type === "late") return `${issue.orderRef} is late`;
  return `${ISSUE_TYPE_LABELS[issue.type]}: ${issue.qty} × ${issue.productName ?? "an item"}`;
}

/** An open problem the buyer reported, waiting for the supplier (BUY-27). */
export function IssueCard({ issue }: { issue: OpenIssue }) {
  const details = [issue.orderRef, formatDateTime(issue.createdAt), issue.note].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3.5 py-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <h3 className="text-[.92rem] font-bold">{titleOf(issue)}</h3>
        <Pill tone="warn">Open</Pill>
      </div>
      <p className="text-[.84rem] text-muted">{details}</p>
    </article>
  );
}
