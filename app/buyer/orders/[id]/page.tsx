import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { plural } from "@/domain/catalogue";
import { formatMoney, lineTotal } from "@/domain/money";
import { requireRole } from "@/data/session";
import { needsCheck } from "@/features/buyer/orders/filters";
import { AssistantChat } from "@/features/ask/AssistantChat";
import { CreditReceivedButton, OrderActions } from "@/features/buyer/orders/OrderActions";
import { OrderProgress } from "@/features/buyer/orders/OrderProgress";
import { getMinimums, orderBelowMinimum } from "@/features/buyer/orders/minimum";
import { getBuyerIssues, getOrderChanges, type OrderChange } from "@/features/buyer/orders/queries";
import { CancelRestButton } from "@/features/buyer/orders/CancelRestButton";
import { LaterStatusPill, restToCome } from "@/features/buyer/orders/rest";
import { TodoActions } from "@/features/buyer/TodoActions";
import { ISSUE_STATUS_PILLS, issueAnswer, problemTitle } from "@/features/buyer/orders/summary";
import { StatusPill } from "@/features/orders/OrderCard";
import { OrderConversation } from "@/features/orders/OrderConversation";
import type { OrderLineView, OrderView } from "@/features/orders/queries";
import { getOrderById } from "@/features/orders/queries";
import { getOrderRequests } from "@/features/orders/requests";
import { singaporeDateOf } from "@/domain/singapore-time";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { formatDate, formatDateTime, orderNumber } from "@/ui/format";
import { Pill } from "@/ui/Pill";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await requireRole("buyer");
  const order = await getOrderById((await params).id, session.orgId);
  return { title: order ? `${orderNumber(order.number)} · Tradelink` : "Order · Tradelink" };
}

const CARD = "min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card";
const TH =
  "border-b border-line bg-[color-mix(in_srgb,var(--color-sunken)_50%,var(--color-surface))] px-4 py-2 text-[.72rem] font-semibold whitespace-nowrap text-muted";

/** What the buyer has to do comes before where the order is, as on the orders list. */
function OrderState({ order }: { order: OrderView }) {
  if (needsCheck(order)) return <Pill tone="warn">Check delivery</Pill>;
  if (order.checkStatus === "problem") return <Pill tone="bad">Problem reported</Pill>;
  return (
    <>
      <StatusPill status={order.status} />
      {order.checkStatus === "all_here" ? <Pill tone="good">All here</Pill> : null}
    </>
  );
}

function LineName({ line }: { line: OrderLineView }) {
  return (
    <>
      <span className="block font-semibold break-words">{line.name}</span>
      <span className="block text-[.75rem] text-muted">
        <span className="font-mono">{line.sku}</span>
        {line.askedQty !== line.qty + line.laterQty ? <span> · You asked for {line.askedQty}</span> : null}
      </span>
      {!line.held ? <span className="block text-[.75rem] font-semibold text-warn">Stock and price to confirm</span> : null}
    </>
  );
}

/** "Not coming, you asked for 3" or "2 of 3 coming". */
function changeText(change: OrderChange): string {
  return change.sent === 0 ? `Not coming, you asked for ${change.asked}` : `${change.sent} of ${change.asked} coming`;
}

/** What the supplier could not send when they accepted, with Order the rest for each item (BUY-04). */
function ChangesCard({ supplierName, changes }: { supplierName: string; changes: OrderChange[] }) {
  return (
    <section aria-labelledby="changes-title" className={`${CARD} border-l-4 border-l-[#C98A1A]`}>
      <div className="px-4 py-3.5">
        <h2 id="changes-title">{supplierName} cannot send everything</h2>
        <p className="mt-0.5 text-[.84rem] text-muted">The total below is for what is coming. Order the rest here or from another supplier.</p>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {changes.map((change) => (
          <li key={change.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[.875rem]">
            <span className="min-w-0 flex-1">
              <b className="font-semibold">{change.productName}</b>
              <span className={change.sent === 0 ? "font-semibold text-warn" : "text-muted"}> · {changeText(change)}</span>
            </span>
            {change.status === "new" ? (
              <span className="flex gap-2">
                <TodoActions action={{ kind: "partial", id: change.id, remainder: Math.max(1, change.asked - change.sent) }} />
              </span>
            ) : (
              <Pill tone="plain">{change.status === "added" ? "Rest added to cart" : "Skipped"}</Pill>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReportLink({ order, line }: { order: OrderView; line: OrderLineView }) {
  return (
    <Link
      href={`/buyer/orders/${order.id}?report=${line.productId}#report`}
      scroll={false}
      className="text-[.8rem] font-semibold text-accent no-underline hover:underline"
    >
      Report<span className="sr-only"> a problem with {line.name}</span>
    </Link>
  );
}

type Later = NonNullable<OrderView["later"]>;

const REST_TITLE: Record<Later["status"], (date: string) => string> = {
  waiting: (date) => `The rest comes ${formatDate(date)}`,
  out_for_delivery: () => "The rest is on the way",
  delivered: () => "The rest is delivered",
  cancelled: () => "The rest is cancelled",
};

function restNote(supplierName: string, later: Later): string {
  switch (later.status) {
    case "waiting":
      return `${supplierName} sends these in a second delivery. You can cancel them until they go out.`;
    case "out_for_delivery":
      return `Due ${formatDate(later.date)}. Check them when they arrive.`;
    case "delivered":
      return "It is in the items above.";
    case "cancelled":
      return `${supplierName} is not sending the rest. Order it again if you still need it.`;
  }
}

/** The second delivery: what is in it, when it comes and where it is (two deliveries per order). */
function RestCard({ order, later }: { order: OrderView; later: Later }) {
  const lines = order.lines.filter((line) => line.laterQty > 0);
  return (
    <section aria-labelledby="rest-title" className={`${CARD} border-l-4 border-l-info`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id="rest-title">{REST_TITLE[later.status](later.date)}</h2>
            <LaterStatusPill status={later.status} />
          </div>
          <p className="mt-0.5 text-[.84rem] text-muted">{restNote(order.supplier.name, later)}</p>
        </div>
        {later.status === "waiting" ? <CancelRestButton orderId={order.id} /> : null}
      </div>
      {lines.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[.875rem]">
              <span className="min-w-0 break-words">
                <b className="font-semibold">{line.name}</b>
                <span className="num text-muted"> {plural(line.laterQty, line.unit)}</span>
              </span>
              <span className="num font-semibold whitespace-nowrap">{formatMoney(lineTotal(line.unitPrice, line.laterQty))}</span>
            </li>
          ))}
          <li className="flex items-center justify-between px-4 py-2.5 text-[.875rem]">
            <span className="text-muted">Second delivery</span>
            <span className="num font-bold">{formatMoney(order.laterCents)}</span>
          </li>
        </ul>
      ) : null}
    </section>
  );
}

/** "S$12.00", or "S$12.00 now" with "+ S$3.90 later" under it. */
function TotalValue({ order }: { order: OrderView }) {
  if (order.laterCents === 0) return <>{formatMoney(order.totalCents)}</>;
  return (
    <>
      <span className="block">{formatMoney(order.totalCents)} now</span>
      <span className="block text-[.8rem] font-semibold text-muted">+ {formatMoney(order.laterCents)} later</span>
    </>
  );
}

function ItemsCard({ order, canReport }: { order: OrderView; canReport: boolean }) {
  const hasLater = order.lines.some((line) => line.laterQty > 0);
  return (
    <section aria-labelledby="items-title" className={`${CARD} @container`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3.5">
        <h2 id="items-title">Items</h2>
        <span className="text-[.8rem] text-muted">
          {canReport ? "Report a line if anything is short or damaged" : plural(order.lines.length, "item")}
        </span>
      </div>

      <table className="hidden w-full border-collapse text-[.84rem] @min-[520px]:table">
        <thead>
          <tr>
            <th scope="col" className={`${TH} text-left`}>
              Item
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {hasLater ? "Now" : "Qty"}
            </th>
            {hasLater ? (
              <th scope="col" className={`${TH} text-right`}>
                Later
              </th>
            ) : null}
            <th scope="col" className={`${TH} text-right`}>
              Price
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Line
            </th>
            {canReport ? (
              <th scope="col" className={TH}>
                <span className="sr-only">Report</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id} className="border-b border-line/70">
              <td className="px-4 py-2.5 align-middle">
                <LineName line={line} />
              </td>
              <td className="num px-4 py-2.5 text-right whitespace-nowrap">{plural(line.qty, line.unit)}</td>
              {hasLater ? (
                <td className="num px-4 py-2.5 text-right whitespace-nowrap">
                  {line.laterQty > 0 ? (
                    <span className="font-semibold text-info">{plural(line.laterQty, line.unit)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              ) : null}
              <td className="num px-4 py-2.5 text-right whitespace-nowrap">{formatMoney(line.unitPrice)}</td>
              <td className="num px-4 py-2.5 text-right font-semibold whitespace-nowrap">{formatMoney(lineTotal(line.unitPrice, line.qty))}</td>
              {canReport ? <td className="px-4 py-2.5 text-right">{line.qty > 0 ? <ReportLink order={order} line={line} /> : null}</td> : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={hasLater ? 4 : 3} className="px-4 py-3 text-right align-top text-muted">
              Total
            </td>
            <td className="num px-4 py-3 text-right text-[.95rem] font-bold whitespace-nowrap">
              <TotalValue order={order} />
            </td>
            {canReport ? <td /> : null}
          </tr>
        </tfoot>
      </table>

      <ul className="divide-y divide-line border-t border-line @min-[520px]:hidden">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3 px-4 py-3 text-[.875rem]">
            <div className="min-w-0 flex-1">
              <LineName line={line} />
              <span className="num block text-[.8rem] text-muted">
                {plural(line.qty, line.unit)} × {formatMoney(line.unitPrice)}
                {line.laterQty > 0 ? <span className="font-semibold text-info"> · + {line.laterQty} later</span> : null}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="num font-semibold">{formatMoney(lineTotal(line.unitPrice, line.qty))}</span>
              {canReport && line.qty > 0 ? <ReportLink order={order} line={line} /> : null}
            </div>
          </li>
        ))}
        <li className="flex items-start justify-between px-4 py-3">
          <span className="text-muted">Total</span>
          <span className="num text-right font-bold">
            <TotalValue order={order} />
          </span>
        </li>
      </ul>
    </section>
  );
}

function DetailsCard({ order, belowCents, minimumCents }: { order: OrderView; belowCents: number; minimumCents: number }) {
  const rows: [string, ReactNode][] = [
    [
      "Order",
      <span key="ref" className="font-mono">
        {orderNumber(order.number)}
      </span>,
    ],
    ["Placed", formatDateTime(order.createdAt)],
    [
      "Delivery",
      order.confirmedDeliveryDate
        ? formatDate(order.confirmedDeliveryDate)
        : order.requestedDeliveryDate
          ? `${formatDate(order.requestedDeliveryDate)}, requested`
          : "Not set yet",
    ],
    ...(order.later
      ? [
          [
            "Rest",
            <span key="rest" className="inline-flex flex-wrap items-center justify-end gap-1.5">
              {formatDate(order.later.date)}
              <LaterStatusPill status={order.later.status} />
            </span>,
          ] satisfies [string, ReactNode],
        ]
      : []),
    ["Supplier", order.supplier.name],
    ...(belowCents > 0
      ? [
          [
            "Minimum",
            <span key="minimum" className="font-semibold text-warn">
              {formatMoney(belowCents)} below the {formatMoney(minimumCents)} minimum
            </span>,
          ] satisfies [string, ReactNode],
        ]
      : []),
    ["Items", plural(order.lines.length, "line")],
    [
      "Total",
      <span key="total" className="num font-semibold">
        {order.laterCents > 0 ? `${formatMoney(order.totalCents)} now + ${formatMoney(order.laterCents)} later` : formatMoney(order.totalCents)}
      </span>,
    ],
  ];
  return (
    <section aria-labelledby="details-title" className={`${CARD} px-4 py-3.5`}>
      <h2 id="details-title">Details</h2>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 text-[.84rem]">
        {rows.map(([label, value]) => (
          <div key={label} className="col-span-2 grid grid-cols-subgrid border-t border-line/70 py-2 first:border-t-0">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BuyerOrderPage({ params, searchParams }: Props) {
  const session = await requireRole("buyer");
  const { id } = await params;
  // RLS hides other businesses' orders, so they read as missing.
  const order = await getOrderById(id, session.orgId);
  if (!order) notFound();
  const [issues, changes, minimums, requests] = await Promise.all([
    getBuyerIssues({ orgId: session.orgId, orderId: order.id }),
    getOrderChanges(order.id),
    getMinimums([order.supplier.id]),
    getOrderRequests(order.id),
  ]);
  const belowCents = orderBelowMinimum(order, minimums);
  const report = firstParam((await searchParams).report);
  // Lines with nothing delivered yet (all of it comes later) cannot be reported.
  const reportProductId = order.lines.some((line) => line.productId === report && line.qty > 0) ? report : undefined;
  const ref = orderNumber(order.number);
  const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  const canReport = needsCheck(order);
  const later = order.later;
  const restToGo = restToCome(order);
  const firstDate = order.status === "pending" || order.status === "accepted" ? delivery : null;
  const restCard = later ? <RestCard order={order} later={later} /> : null;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[.8rem]">
        <Link href="/buyer/orders" className="font-medium text-accent no-underline hover:underline">
          Orders
        </Link>
        <span className="text-muted"> / {ref}</span>
      </nav>

      <OrderActions key={reportProductId ?? "order"} order={order} reportProductId={reportProductId}>
        <div className="flex items-center gap-3.5">
          <BusinessLogo name={order.supplier.name} seedKey={order.supplier.id || undefined} size={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 break-words">{order.supplier.name}</h1>
              <OrderState order={order} />
              {belowCents > 0 ? <Pill tone="warn">Below minimum</Pill> : null}
            </div>
            <p className="num flex flex-wrap gap-x-1.5 text-[.84rem] text-muted">
              <span className="font-mono text-ink">{ref}</span>
              <span aria-hidden="true">·</span>
              <span>placed {formatDateTime(order.createdAt)}</span>
              {delivery ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {order.confirmedDeliveryDate ? "delivery" : "delivery requested"} {formatDate(delivery)}
                    {later && later.status !== "cancelled" ? `, rest ${formatDate(later.date)}` : null}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </OrderActions>

      <OrderProgress order={order} />

      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[820px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {changes.length > 0 ? <ChangesCard supplierName={order.supplier.name} changes={changes} /> : null}
            {restToGo ? restCard : null}
            <ItemsCard order={order} canReport={canReport} />
            {restToGo ? null : restCard}

            {issues.length > 0 ? (
              <section id="problems" aria-labelledby="problems-title" className={`${CARD} scroll-mt-6`}>
                <div className="px-4 py-3.5">
                  <h2 id="problems-title">Problems</h2>
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {issues.map((issue) => {
                    const pill = ISSUE_STATUS_PILLS[issue.status];
                    return (
                      <li key={issue.id} className="flex flex-col gap-1.5 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-[.875rem] font-semibold">{problemTitle(issue)}</p>
                          <Pill tone={pill.tone}>{pill.label}</Pill>
                        </div>
                        <p className="text-[.8rem] text-muted">
                          Reported {formatDateTime(issue.createdAt)}
                          {issue.note ? <> · {issue.note}</> : null}
                        </p>
                        <p className="text-[.875rem]">{issueAnswer(issue)}</p>
                        {issue.status === "credit_promised" ? (
                          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-warn-soft/60 px-3 py-2">
                            <p className="min-w-0 flex-1 text-[.84rem]">This problem closes once you confirm the credit has reached you.</p>
                            <CreditReceivedButton issueId={issue.id} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <OrderConversation
              orderId={order.id}
              myOrgId={session.orgId}
              otherName={order.supplier.name}
              requests={requests}
              firstDate={firstDate}
              restDate={later?.status === "waiting" ? later.date : null}
              today={singaporeDateOf(new Date())}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <AssistantChat
              hello=""
              userId={session.userId}
              role="buyer"
              inline={{
                context: ref,
                intro: `Ask about this order, such as what to count first or how ${order.supplier.name} has delivered lately.`,
                placeholder: "Ask about this order",
              }}
            />
            <DetailsCard order={order} belowCents={belowCents} minimumCents={minimums.get(order.supplier.id) ?? 0} />
          </div>
        </div>
      </div>
    </div>
  );
}
