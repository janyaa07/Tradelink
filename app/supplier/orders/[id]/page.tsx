import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getCatalogue } from "@/data/catalogue";
import { requireRole } from "@/data/session";
import { plural, type CatalogueItem } from "@/domain/catalogue";
import { formatMoney, lineTotal, toCents } from "@/domain/money";
import { StatusPill } from "@/features/orders/OrderCard";
import type { OrderLineView, OrderView } from "@/features/orders/queries";
import { ConfirmAddedProducts } from "@/features/supplier/ConfirmAddedProducts";
import { defaultDeliveryDate, todayInSingapore } from "@/features/supplier/dates";
import { newIdempotencyKey } from "@/features/supplier/keys";
import { belowMinimumNote, orderBelowMinimum } from "@/features/supplier/minimum";
import { OrderPageActions } from "@/features/supplier/OrderPageActions";
import { OrderProblem } from "@/features/supplier/OrderProblems";
import { getBusinessProfile, getBuyerContact, getOrderIssues, getSupplierOrder, type BuyerContact } from "@/features/supplier/queries";
import { SupplierOrderProgress } from "@/features/supplier/SupplierOrderProgress";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { formatDate, formatDateTime, orderNumber } from "@/ui/format";
import { Pill } from "@/ui/Pill";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await requireRole("supplier");
  const order = await getSupplierOrder((await params).id, session.orgId);
  return { title: order ? `${orderNumber(order.number)} · Tradelink` : "Order · Tradelink" };
}

const CARD = "min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card";
const TH =
  "border-b border-line bg-[color-mix(in_srgb,var(--color-sunken)_50%,var(--color-surface))] px-4 py-2 text-[.72rem] font-semibold whitespace-nowrap text-muted";
const TD = "px-4 py-2.5 align-middle";

function LineName({ line }: { line: OrderLineView }) {
  return (
    <>
      <span className="block font-semibold break-words">{line.name}</span>
      {line.askedQty !== line.qty ? <span className="block text-[.75rem] text-muted">Buyer asked for {line.askedQty}</span> : null}
      {!line.held ? <span className="block text-[.75rem] font-semibold text-warn">Stock and price to confirm</span> : null}
    </>
  );
}

function ItemsCard({ order }: { order: OrderView }) {
  return (
    <section aria-labelledby="items-title" className={`${CARD} @container`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3.5">
        <h2 id="items-title">Items</h2>
        <span className="text-[.8rem] text-muted">{plural(order.lines.length, "item")}</span>
      </div>

      <table className="hidden w-full border-collapse text-[.84rem] @min-[560px]:table">
        <thead>
          <tr>
            <th scope="col" className={`${TH} text-left`}>
              Item
            </th>
            <th scope="col" className={`${TH} text-left`}>
              SKU
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Qty
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Price
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Line total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id} className="border-b border-line/70">
              <td className={TD}>
                <LineName line={line} />
              </td>
              <td className={`${TD} font-mono text-[.78rem] whitespace-nowrap text-muted`}>{line.sku}</td>
              <td className={`${TD} num text-right whitespace-nowrap`}>{plural(line.qty, line.unit)}</td>
              <td className={`${TD} num text-right whitespace-nowrap`}>{formatMoney(line.unitPrice)}</td>
              <td className={`${TD} num text-right font-semibold whitespace-nowrap`}>{formatMoney(lineTotal(line.unitPrice, line.qty))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="px-4 py-3 text-right text-muted">
              Total
            </td>
            <td className="num px-4 py-3 text-right text-[.95rem] font-bold whitespace-nowrap">{formatMoney(order.totalCents)}</td>
          </tr>
        </tfoot>
      </table>

      <ul className="divide-y divide-line border-t border-line @min-[560px]:hidden">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3 px-4 py-3 text-[.875rem]">
            <div className="min-w-0 flex-1">
              <LineName line={line} />
              <span className="num block text-[.8rem] text-muted">
                <span className="font-mono">{line.sku}</span> · {plural(line.qty, line.unit)} × {formatMoney(line.unitPrice)}
              </span>
            </div>
            <span className="num font-semibold">{formatMoney(lineTotal(line.unitPrice, line.qty))}</span>
          </li>
        ))}
        <li className="flex items-center justify-between px-4 py-3">
          <span className="text-muted">Total</span>
          <span className="num font-bold">{formatMoney(order.totalCents)}</span>
        </li>
      </ul>
    </section>
  );
}

function deliveryText(order: OrderView): string {
  if (order.confirmedDeliveryDate) return formatDate(order.confirmedDeliveryDate);
  if (order.requestedDeliveryDate) return `${formatDate(order.requestedDeliveryDate)}, requested`;
  return "Not set yet";
}

function DetailsCard({ order, contact }: { order: OrderView; contact: BuyerContact | null }) {
  const rows: [string, ReactNode][] = [
    [
      "Order",
      <span key="ref" className="font-mono">
        {orderNumber(order.number)}
      </span>,
    ],
    ["Placed", formatDateTime(order.createdAt)],
    ["Delivery", deliveryText(order)],
    ["Buyer", order.buyer.name],
  ];
  if (contact?.contact) rows.push(["Contact", contact.contact]);
  if (contact?.phone) {
    rows.push([
      "Phone",
      <a key="phone" href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="num font-medium text-accent no-underline hover:underline">
        {contact.phone}
      </a>,
    ]);
  }
  if (contact?.email) rows.push(["Email", contact.email]);
  if (contact?.address) rows.push(["Address", contact.address]);
  rows.push(
    ["Items", plural(order.lines.length, "line")],
    [
      "Total",
      <span key="total" className="num font-semibold">
        {formatMoney(order.totalCents)}
      </span>,
    ],
  );
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

/** The buyer-added products on this order that still need their stock confirmed, as catalogue items for the confirm form. */
function addedProducts(order: OrderView, catalogue: CatalogueItem[]): CatalogueItem[] {
  const ids = new Set(order.lines.filter((line) => !line.held && line.productUnconfirmed).map((line) => line.productId));
  return catalogue.filter((item) => ids.has(item.id) && item.status === "unconfirmed");
}

export default async function SupplierOrderPage({ params }: Props) {
  const session = await requireRole("supplier");
  const { id } = await params;
  // RLS hides other businesses' orders, and another supplier's order reads as missing too.
  const order = await getSupplierOrder(id, session.orgId);
  if (!order) notFound();

  const unconfirmed = order.lines.filter((line) => !line.held && line.productUnconfirmed);
  const [profile, issues, contact, catalogue] = await Promise.all([
    getBusinessProfile(session.orgId),
    getOrderIssues(session.orgId, order.id),
    getBuyerContact(order.buyer.id),
    unconfirmed.length > 0 ? getCatalogue({ supplierOrgId: session.orgId }) : Promise.resolve<CatalogueItem[]>([]),
  ]);

  const now = new Date();
  const ref = orderNumber(order.number);
  const delivery = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
  const minimumCents = toCents(profile.minimum);
  const gap = orderBelowMinimum(order, minimumCents);
  const toConfirm = addedProducts(order, catalogue);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[.8rem]">
        <Link href="/supplier/orders" className="font-medium text-accent no-underline hover:underline">
          Orders
        </Link>
        <span className="text-muted"> / {ref}</span>
      </nav>

      <OrderPageActions
        order={order}
        idemKey={newIdempotencyKey()}
        minDate={todayInSingapore(now)}
        defaultDate={defaultDeliveryDate(order.requestedDeliveryDate, now)}
        unconfirmed={unconfirmed.map((line) => line.name)}
      >
        <div className="flex items-center gap-3.5">
          <BusinessLogo name={order.buyer.name} seedKey={order.buyer.id || undefined} size={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 break-words">{order.buyer.name}</h1>
              <StatusPill status={order.status} />
              {order.checkStatus === "all_here" ? <Pill tone="good">All here</Pill> : null}
              {order.checkStatus === "problem" ? <Pill tone="warn">Problem reported</Pill> : null}
              {gap > 0 ? <Pill tone="warn">Below minimum</Pill> : null}
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
                  </span>
                </>
              ) : null}
            </p>
            {gap > 0 ? <p className="num text-[.84rem] font-semibold text-warn">{belowMinimumNote(gap, minimumCents)}</p> : null}
          </div>
        </div>
      </OrderPageActions>

      <SupplierOrderProgress order={order} />

      <div className="@container">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[820px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {toConfirm.length > 0 ? (
              <section aria-labelledby="confirm-title" className={CARD}>
                <div className="flex flex-col gap-0.5 px-4 py-3.5">
                  <h2 id="confirm-title">Products a buyer added</h2>
                  <p className="text-[.8rem] text-muted">
                    {order.status === "pending"
                      ? "Confirm the price and stock you have before you accept this order."
                      : "Confirm the price and stock you have so buyers can order these normally."}
                  </p>
                </div>
                <ConfirmAddedProducts products={toConfirm.map((item) => ({ item, idemKey: newIdempotencyKey() }))} />
              </section>
            ) : null}

            <ItemsCard order={order} />

            {issues.length > 0 ? (
              <section id="problems" aria-labelledby="problems-title" className={`${CARD} scroll-mt-6`}>
                <div className="px-4 py-3.5">
                  <h2 id="problems-title">Problems</h2>
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {issues.map((issue) => (
                    <OrderProblem key={issue.id} issue={issue} idemKey={newIdempotencyKey()} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <DetailsCard order={order} contact={contact} />
        </div>
      </div>
    </div>
  );
}
