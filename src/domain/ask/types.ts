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

export const ASK_LINK_LABELS = [
  "Open Insights",
  "See all suppliers",
  "View cart",
  "Review cart",
  "View orders",
  "Open order",
  "Open inventory",
] as const;
export type AskLinkLabel = (typeof ASK_LINK_LABELS)[number];

export type AskAction =
  | { kind: "link"; label: AskLinkLabel; href: string }
  | { kind: "add_to_cart"; lines: CartLine[] }
  /**
   * Place the cart as it was when the assistant read it: one order per supplier. Only the buyer's
   * tap places it; the server refuses if the cart has changed since (draftVersion).
   */
  | { kind: "place_cart"; draftVersion: number; orders: number }
  /** A change Tradelink AI proposes. It runs only when the person taps Confirm. */
  | { kind: "confirm"; proposal: AiProposal };

/**
 * A change proposed by Tradelink AI: which tool, its checked arguments, and the words shown on the
 * confirm card. The id doubles as the idempotency key, so a second tap does nothing twice.
 */
export type AiProposal = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  title: string;
  details: string[];
  confirmLabel: string;
};

export type AskReply = { text: string; cards: AskCard[]; actions: AskAction[] };
