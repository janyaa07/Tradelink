import type { ArtKind, Category } from "@/domain/catalogue";
import type { DraftState } from "@/features/ordering/draft";
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

export type PriceCardData = {
  name: string;
  art: ArtKind;
  category: Category;
  /** "S$38.50 per tin". */
  price: string;
  supplierName: string;
  available: string;
  lastPaid: string | null;
};

export type ReadLineStatus = "Matched" | "Check this" | "Not found";

/** One row of a lines card: "2 × Fresh eggs", its match state (typed orders only), a note and the line price. */
export type LineRow = { label: string; status: ReadLineStatus | null; note: string | null; price: string | null };

/** Typed cards the app renders. The model never supplies markup (ADR 0009). */
export type AskCard =
  | { kind: "order"; order: OrderCardData }
  | { kind: "price"; price: PriceCardData }
  | { kind: "lines"; rows: LineRow[] };

/**
 * A line the assistant offers to add to the cart, keeping the reader's state and options. A line
 * with no product stays in the cart for the buyer to resolve. Nothing is placed from chat.
 */
export type CartLine = {
  productId: string | null;
  qty: number;
  sourceText: string;
  options: string[];
  state: DraftState;
  kg: number | null;
  qtyAssumed: boolean;
};

export type AskAction =
  | { kind: "link"; label: "Open Insights" | "See all suppliers" | "View cart"; href: string }
  | { kind: "add_to_cart"; lines: CartLine[] };

export type AskReply = { text: string; cards: AskCard[]; actions: AskAction[] };
