import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { callRpc } from "@/data/rpc";
import { DevCardsPanel } from "@/features/cards/DevCardsPanel";
import { devPagesEnabled, getMyShop } from "@/features/cards/shop";
import { ThreadFeed } from "@/features/cards/ThreadFeed";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";

export const metadata: Metadata = { title: "Test cards · Restock", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Dev only: makes test cards for the M0 round-trip (render, edit to v2, stale tap, Realtime). */
export default async function DevCardsPage() {
  if (!devPagesEnabled()) notFound();
  const shop = await getMyShop();
  const thread = shop?.role === "owner" ? await callRpc<string>("rs_shop_thread", { p_shop: shop.shopId }) : null;

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-6">
      <header className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[.82rem] font-semibold text-muted">Restock dev</span>
          <h1>Test cards</h1>
        </div>
        <LinkButton variant="text" href="/r">
          Back
        </LinkButton>
      </header>
      {shop?.role !== "owner" ? (
        <EmptyState>Sign in as a shop owner to make test cards.</EmptyState>
      ) : thread?.ok && typeof thread.data === "string" ? (
        <>
          <DevCardsPanel />
          <ThreadFeed threadId={thread.data} />
        </>
      ) : (
        <EmptyState>The shop chat could not be opened.</EmptyState>
      )}
    </main>
  );
}
