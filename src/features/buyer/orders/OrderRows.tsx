import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/domain/money";
import { StatusPill } from "@/features/orders/OrderCard";
import type { OrderView } from "@/features/orders/queries";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { formatDateTime, orderNumber } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { needsCheck } from "./filters";
import type { BuyerIssue } from "./queries";
import { ISSUE_STATUS_PILLS, itemSummary, problemSummary } from "./summary";

const ROW_LINK =
  "flex items-start gap-3 px-4 py-3.5 text-ink no-underline transition-colors duration-150 hover:bg-sunken focus-visible:outline-offset-[-2px] rail:items-center rail:px-5";

/** The bordered list that holds the rows. */
export function RowList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {children}
    </ul>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="flex-none text-[.75rem] font-semibold text-warn">{children}</span>;
}

/** One order: supplier, number, date, items, total and status. Opens the order. */
export function OrderRow({ order }: { order: OrderView }) {
  const items = itemSummary(order.lines.map((line) => line.name));
  const tag = needsCheck(order) ? "Check delivery" : order.checkStatus === "problem" ? "Problem reported" : null;
  return (
    <li>
      <Link href={`/buyer/orders/${order.id}`} className={ROW_LINK}>
        <BusinessLogo name={order.supplier.name} seedKey={order.supplier.id || undefined} size={40} />
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rail:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_6.5rem_8.5rem] rail:items-center">
          <div className="min-w-0">
            <p className="truncate font-semibold">{order.supplier.name}</p>
            <p className="truncate text-[.84rem] text-muted">
              <span className="font-mono text-[.8rem]">{orderNumber(order.number)}</span>
              <span aria-hidden="true"> · </span>
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          <p className="num text-right font-semibold rail:order-3">{formatMoney(order.totalCents)}</p>
          <div className="flex min-w-0 items-center gap-2 text-[.84rem] text-muted rail:order-2 rail:flex-col rail:items-start rail:gap-0">
            <p className="flex min-w-0 max-w-full gap-1.5">
              <span className="flex-none text-ink">{items.count}</span>
              {items.names ? <span className="truncate">{items.names}</span> : null}
            </p>
            {tag ? <Tag>{tag}</Tag> : null}
          </div>
          <div className="justify-self-end rail:order-4">
            <StatusPill status={order.status} />
          </div>
        </div>
      </Link>
    </li>
  );
}

/** One reported problem, explained in a line. Opens its order. */
export function ProblemRow({ issue }: { issue: BuyerIssue }) {
  const pill = ISSUE_STATUS_PILLS[issue.status];
  return (
    <li>
      <Link href={`/buyer/orders/${issue.orderId}#problems`} className={ROW_LINK}>
        <BusinessLogo name={issue.supplierName} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-semibold">{problemSummary(issue)}</p>
            <Pill tone={pill.tone}>{pill.label}</Pill>
          </div>
          <p className="truncate text-[.84rem] text-muted">
            <span className="font-mono text-[.8rem]">{orderNumber(issue.orderNumber)}</span>
            <span aria-hidden="true"> · </span>
            Reported {formatDateTime(issue.createdAt)}
          </p>
        </div>
      </Link>
    </li>
  );
}
