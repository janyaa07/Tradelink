import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AssistantChat } from "@/features/ask/AssistantChat";

export const metadata: Metadata = { title: "Tradelink Assistant" };

export default async function BuyerAssistantPage() {
  const session = await requireRole("buyer");
  const firstName = session.fullName.trim().split(/\s+/)[0] || "there";
  return (
    <>
      <h1 className="sr-only">Tradelink Assistant</h1>
      <AssistantChat firstName={firstName} />
    </>
  );
}
