import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { BuyerOrderCard } from "@/features/buyer/BuyerOrderCard";
import { IssueCard } from "@/features/buyer/IssueCard";
import { getOpenIssues } from "@/features/buyer/todo-queries";
import { getOrders } from "@/features/orders/queries";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";
import { RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Orders · Tradelink" };

const PAGE_SIZE = 30;
const MAX_SHOWN = 300;

function shownFrom(value: string | string[] | undefined): number {
  const requested = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(requested) || requested < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(MAX_SHOWN, Math.ceil(requested / PAGE_SIZE) * PAGE_SIZE);
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BuyerOrdersPage({ searchParams }: Props) {
  const session = await requireRole("buyer");
  const shown = shownFrom((await searchParams).show);
  const [orders, issues] = await Promise.all([
    getOrders({ buyerOrgId: session.orgId, limit: shown + 1 }),
    getOpenIssues(session.orgId),
  ]);
  const hasMore = orders.length > shown && shown < MAX_SHOWN;

  return (
    <>
      <div className="flex flex-col gap-[3px]">
        <h1>Orders</h1>
        <p className="text-muted">Orders placed by {session.orgName}.</p>
      </div>
      {issues.length > 0 ? (
        <section aria-labelledby="problems-title" className="flex flex-col gap-2.5">
          <h2 id="problems-title">Open problems</h2>
          <RecordList>
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </RecordList>
        </section>
      ) : null}
      <section aria-labelledby="orders-title" className="flex flex-col gap-2.5">
        {issues.length > 0 ? <h2 id="orders-title">Orders</h2> : <h2 id="orders-title" className="sr-only">Orders</h2>}
        {orders.length === 0 ? (
          <EmptyState action={<LinkButton href="/buyer/order">New order</LinkButton>}>No orders yet.</EmptyState>
        ) : (
          <RecordList>
            {orders.slice(0, shown).map((order) => (
              <BuyerOrderCard key={order.id} order={order} />
            ))}
          </RecordList>
        )}
        {hasMore ? (
          <LinkButton href={`/buyer/orders?show=${shown + PAGE_SIZE}`} scroll={false} className="self-center">
            Show more
          </LinkButton>
        ) : null}
      </section>
    </>
  );
}
