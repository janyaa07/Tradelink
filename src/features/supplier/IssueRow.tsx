"use client";

import { Button } from "@/ui/Button";
import { formatDateTime, orderNumber } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { Pill } from "@/ui/Pill";
import { answerIssueAction } from "./orderActions";
import { answerOptions, issueHeading, type IssueView } from "./issues";
import { useSupplierForm } from "./useSupplierForm";

/** An open problem as one row of the problems strip, with the answers it allows (SUP-09). Each answer can be given once. */
export function IssueRow({ issue, idemKey }: { issue: IssueView; idemKey: string }) {
  const { onSubmit, error, pending } = useSupplierForm(answerIssueAction);
  const details = [orderNumber(issue.orderNumber), issueHeading(issue), issue.note, formatDateTime(issue.createdAt)].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-col gap-2 border-t border-line/70 px-4 py-3 first:border-t-0 rail:flex-row rail:items-center rail:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Pill tone="bad">Problem</Pill>
        <p className="min-w-0 break-words text-[.875rem]">
          <b className="font-semibold">{issue.buyerName}</b> <span className="text-muted">· {details}</span>
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-1.5 rail:flex-none rail:justify-end">
        <input type="hidden" name="issueId" value={issue.id} />
        <input type="hidden" name="key" value={idemKey} />
        <input type="hidden" name="buyerName" value={issue.buyerName} />
        {answerOptions(issue).map((option) => (
          <Button key={option.answer} type="submit" name="answer" value={option.answer} variant={option.variant} size="small" disabled={pending}>
            {option.label}
          </Button>
        ))}
      </form>
      <FormError>{error}</FormError>
    </li>
  );
}
