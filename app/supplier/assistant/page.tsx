import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AssistantChat } from "@/features/ask/AssistantChat";

export const metadata: Metadata = { title: "Tradelink AI" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SupplierAssistantPage({ searchParams }: Props) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const text = first(params.q).slice(0, 2000);
  const question = text ? { text, stamp: first(params.t).slice(0, 20) } : undefined;
  const session = await requireRole("supplier");
  const firstName = session.fullName.trim().split(/\s+/)[0] || "there";
  return <AssistantChat firstName={firstName} userId={session.userId} role="supplier" initialQuestion={question} />;
}
