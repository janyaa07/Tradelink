"use client";

import { Button } from "@/ui/Button";
import { formatDateTime, orderNumber } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { Pill } from "@/ui/Pill";
import { answerIssueAction } from "./orderActions";
import { answerOptions, issueHeading, type IssueView } from "./issues";
import { useSupplierForm } from "./useSupplierForm";

/** An open problem with the answers it allows (SUP-09). Each answer can be given once. */
export function IssueCard({ issue, idemKey }: { issue: IssueView; idemKey: string }) {
  const { onSubmit, error, pending } = useSupplierForm(answerIssueAction);
  const details = [issue.buyerName, orderNumber(issue.orderNumber), formatDateTime(issue.createdAt), issue.note]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface px-3.5 py-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h3 className="break-words text-[.92rem] font-bold">{issueHeading(issue)}</h3>
        <Pill tone="warn">Open</Pill>
      </div>
      <p className="break-words text-[.84rem] text-muted">{details}</p>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-1.5">
        <input type="hidden" name="issueId" value={issue.id} />
        <input type="hidden" name="key" value={idemKey} />
        <input type="hidden" name="buyerName" value={issue.buyerName} />
        {answerOptions(issue).map((option) => (
          <Button key={option.answer} type="submit" name="answer" value={option.answer} variant={option.variant} disabled={pending}>
            {option.label}
          </Button>
        ))}
      </form>
      <FormError>{error}</FormError>
    </article>
  );
}
