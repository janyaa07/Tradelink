import type { Metadata } from "next";
import { callRpc } from "@/data/rpc";
import { devPagesEnabled, getMyShop } from "@/features/cards/shop";
import { ThreadFeed } from "@/features/cards/ThreadFeed";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";

export const metadata: Metadata = { title: "Restock" };
export const dynamic = "force-dynamic";

/** Restock home (M0): the shop's chat thread with its cards. */
export default async function RestockHomePage() {
  const shop = await getMyShop();
  if (!shop) {
    return (
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-6">
        <h1>Restock</h1>
        <EmptyState>Your account is not linked to a shop yet. Ask your Restock contact to add you.</EmptyState>
      </main>
    );
  }

  const thread = await callRpc<string>("rs_shop_thread", { p_shop: shop.shopId });
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-6">
      <header className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[.82rem] font-semibold text-muted">Restock</span>
          <h1 className="[overflow-wrap:anywhere]">{shop.shopName}</h1>
        </div>
        {devPagesEnabled() && shop.role === "owner" ? (
          <LinkButton variant="text" href="/r/dev/cards">
            Test cards
          </LinkButton>
        ) : null}
      </header>
      {thread.ok && typeof thread.data === "string" ? (
        <ThreadFeed threadId={thread.data} />
      ) : (
        <EmptyState>{thread.ok ? "The shop chat could not be opened." : thread.error}</EmptyState>
      )}
    </main>
  );
}
