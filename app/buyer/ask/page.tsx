import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AskChat } from "@/features/ask/AskChat";

export const metadata: Metadata = { title: "Ask · Tradelink" };

export default async function BuyerAskPage() {
  const session = await requireRole("buyer");
  const firstName = session.fullName.trim().split(/\s+/)[0] || "there";
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-4">
      <div className="flex flex-col gap-[3px]">
        <h1>Ask Tradelink</h1>
        <p className="text-muted">Order in your own words or ask about your shop.</p>
      </div>
      <AskChat firstName={firstName} />
    </div>
  );
}
