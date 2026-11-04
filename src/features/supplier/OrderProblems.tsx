"use client";

import { Button } from "@/ui/Button";
import { formatDateTime } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { Pill } from "@/ui/Pill";
import { answerIssueAction } from "./orderActions";
import { answerOptions, issueHeading, ISSUE_STATUS_PILLS, type OrderIssueView } from "./issues";
import { useSupplierForm } from "./useSupplierForm";

/** One problem on the order page; an open one has the same answers as the problems strip (SUP-09). */
export function OrderProblem({ issue, idemKey }: { issue: OrderIssueView; idemKey: string }) {
  const { onSubmit, error, pending } = useSupplierForm(answerIssueAction);
  const pill = ISSUE_STATUS_PILLS[issue.status];

  return (
    <li className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[.875rem] font-semibold break-words">{issueHeading(issue)}</p>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </div>
      <p className="text-[.8rem] text-muted">
        Reported {formatDateTime(issue.createdAt)}
        {issue.note ? <> · {issue.note}</> : null}
      </p>
      {issue.status === "open" ? (
        <form onSubmit={onSubmit} className="flex flex-wrap gap-1.5 pt-1">
          <input type="hidden" name="issueId" value={issue.id} />
          <input type="hidden" name="key" value={idemKey} />
          <input type="hidden" name="buyerName" value={issue.buyerName} />
          {answerOptions(issue).map((option) => (
            <Button key={option.answer} type="submit" name="answer" value={option.answer} variant={option.variant} size="small" disabled={pending}>
              {option.label}
            </Button>
          ))}
        </form>
      ) : null}
      <FormError>{error}</FormError>
    </li>
  );
}
