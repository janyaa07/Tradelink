import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AssistantChat } from "@/features/ask/AssistantChat";

export const metadata: Metadata = { title: "Tradelink AI" };

export default async function BuyerAssistantPage() {
  const session = await requireRole("buyer");
  const firstName = session.fullName.trim().split(/\s+/)[0] || "there";
  return (
    <>
      <h1 className="sr-only">Tradelink AI</h1>
      <AssistantChat firstName={firstName} userId={session.userId} role="buyer" />
    </>
  );
}
