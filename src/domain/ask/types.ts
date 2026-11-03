import type { OrderStatus } from "@/ui/ProgressSteps";

/** One earlier turn of the session's conversation, kept in client state only (BUY-47.4). */
export type AskTurn = { role: "buyer" | "tradelink"; text: string };

export type OrderCardData = {
  number: number;
  status: OrderStatus;
  supplierName: string;
  /** Confirmed date, else requested date, as "2026-11-04". */
  deliveryDate: string | null;
  lines: { qty: number; name: string }[];
  totalCents: number;
};

export type PlanItem = { name: string; daysLeft: string };

export type PriceCardData = { supplierName: string; available: string; lastPaid: string | null };

export type ReadLineStatus = "Matched" | "Check this" | "Not found";

export type ReadLineView = { label: string; status: ReadLineStatus };

/** Typed cards the app renders. The model never supplies markup (ADR 0009). */
export type AskCard =
  | { kind: "order"; order: OrderCardData }
  | { kind: "plan"; items: PlanItem[] }
  | { kind: "price"; price: PriceCardData }
  | { kind: "read"; lines: ReadLineView[] };

/** A line Ask read from a typed order, ready to move into the draft for review (BUY-49). */
export type ReviewLine = {
  productId: string;
  qty: number;
  sourceText: string;
  options: string[];
  state: "manual" | "suggested";
};

export type AskAction =
  | { kind: "link"; label: "Open Insights" | "See all suppliers"; href: string }
  | { kind: "load_plan" }
  | { kind: "load_usual" }
  | { kind: "review_order"; lines: ReviewLine[] };

export type AskReply = { text: string; cards: AskCard[]; actions: AskAction[] };
