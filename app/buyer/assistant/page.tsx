import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { AssistantChat } from "@/features/ask/AssistantChat";
import { loadBuyerSteps } from "@/features/home/steps";
import { greeting } from "@/ui/format";

export const metadata: Metadata = { title: "Tradelink AI" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuyerAssistantPage({ searchParams }: Props) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const text = first(params.q).slice(0, 2000);
  const question = text ? { text, stamp: first(params.t).slice(0, 20) } : undefined;
  const session = await requireRole("buyer");
  const firstName = session.fullName.trim().split(/\s+/)[0] || "there";
  const now = new Date();
  const { steps } = await loadBuyerSteps(session.orgId, now);
  const facts = steps.slice(0, 4).map((step) => ({ tone: step.tone, text: step.title }));
  return <AssistantChat hello={`${greeting(now)}, ${firstName}`} userId={session.userId} role="buyer" initialQuestion={question} facts={facts} />;
}
