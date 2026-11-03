import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, lineTotal } from "@/domain/money";
import { requireRole } from "@/data/session";
import { CreditReceivedButton, OrderActions } from "@/features/buyer/orders/OrderActions";
import { getBuyerIssues } from "@/features/buyer/orders/queries";
import { ISSUE_STATUS_PILLS, issueAnswer, problemTitle } from "@/features/buyer/orders/summary";
import { StatusPill } from "@/features/orders/OrderCard";
import { getOrderById } from "@/features/orders/queries";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { formatDate, formatDateTime, orderNumber } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { ProgressSteps } from "@/ui/ProgressSteps";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await requireRole("buyer");
  const order = await getOrderById((await params).id, session.orgId);
  return { title: order ? `${orderNumber(order.number)} · Tradelink` : "Order · Tradelink" };
}

const PANEL = "rounded-xl border border-line bg-surface";

export default async function BuyerOrderPage({ params }: Props) {
  const session = await requireRole("buyer");
  const { id } = await params;
  // RLS hides other businesses' orders, so they read as missing.
  const order = await getOrderById(id, session.orgId);
  if (!order) notFound();
  const issues = await getBuyerIssues({ orgId: session.orgId, orderId: order.id });
  const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/buyer/orders"
        className="inline-flex items-center gap-1 self-start text-[.9rem] font-semibold text-accent no-underline hover:underline"
      >
        <span aria-hidden="true">‹</span> All orders
      </Link>

      <header className="flex items-start gap-4">
        <BusinessLogo name={order.supplier.name} seedKey={order.supplier.id || undefined} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="min-w-0 break-words">{order.supplier.name}</h1>
            <StatusPill status={order.status} />
            {order.checkStatus === "all_here" ? <Pill tone="good">All here</Pill> : null}
            {order.checkStatus === "problem" ? <Pill tone="warn">Problem reported</Pill> : null}
          </div>
          <p className="flex flex-wrap gap-x-2 text-[.9rem] text-muted">
            <span className="font-mono text-[.86rem] text-ink">{orderNumber(order.number)}</span>
            <span aria-hidden="true">·</span>
            <span>Placed {formatDateTime(order.createdAt)}</span>
            {delivery ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {order.confirmedDeliveryDate ? "Delivery" : "Delivery requested"} {formatDate(delivery)}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <ProgressSteps status={order.status} />

      <OrderActions order={order} />

      <section aria-labelledby="items-title" className="flex flex-col gap-3">
        <h2 id="items-title">Items</h2>
        <div className={PANEL}>
          <ul className="divide-y divide-line">
            {order.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 px-4 py-3 rail:px-5">
                <ProductArt kind={line.art} size={42} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words font-semibold">{line.name}</span>
                  <span className="text-[.84rem] text-muted">
                    <span className="num">
                      {line.qty} × {formatMoney(line.unitPrice)}
                    </span>
                    {line.askedQty !== line.qty ? <span> · You asked for {line.askedQty}</span> : null}
                  </span>
                  {!line.held ? <span className="text-[.75rem] font-semibold text-warn">Stock and price to confirm</span> : null}
                </div>
                <span className="num font-semibold">{formatMoney(lineTotal(line.unitPrice, line.qty))}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line px-4 py-3.5 rail:px-5">
            <span className="font-semibold">Total</span>
            <span className="num text-[1.05rem] font-bold">{formatMoney(order.totalCents)}</span>
          </div>
        </div>
      </section>

      {issues.length > 0 ? (
        <section id="problems" aria-labelledby="problems-title" className="flex scroll-mt-6 flex-col gap-3">
          <h2 id="problems-title">Problems</h2>
          <ul className={`${PANEL} divide-y divide-line`}>
            {issues.map((issue) => {
              const pill = ISSUE_STATUS_PILLS[issue.status];
              return (
                <li key={issue.id} className="flex flex-col gap-2 px-4 py-3.5 rail:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold">{problemTitle(issue)}</p>
                    <Pill tone={pill.tone}>{pill.label}</Pill>
                  </div>
                  <p className="text-[.84rem] text-muted">
                    Reported {formatDateTime(issue.createdAt)}
                    {issue.note ? <> · {issue.note}</> : null}
                  </p>
                  <p className="text-[.9rem]">{issueAnswer(issue)}</p>
                  {issue.status === "credit_promised" ? (
                    <div>
                      <CreditReceivedButton issueId={issue.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
