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
export type AskCard = { kind: "order"; order: OrderCardData } | { kind: "price"; price: PriceCardData } | { kind: "lines"; rows: LineRow[] } | AiCard;

/**
 * Tradelink AI cards. The server builds them from the database; the answer shows one by writing its
 * key as a tag, so only the cards the answer is about appear, under the sentence they belong to.
 */
export type AiCard =
  | { kind: "ai_order"; key: string; view: "buyer" | "supplier"; order: AiOrder }
  | { kind: "ai_product"; key: string; product: AiProduct }
  | { kind: "ai_stock"; key: string; stock: AiStock }
  | { kind: "ai_problem"; key: string; problem: AiProblem }
  | { kind: "ai_alert"; key: string; alert: AiAlert }
  | { kind: "ai_cart"; key: string; cart: AiCart }
  | { kind: "ai_spend"; key: string; spend: { spentCents: number; budgetCents: number } }
  | { kind: "ai_supplier"; key: string; supplier: AiSupplier }
  | { kind: "ai_new_product"; key: string; view: "buyer" | "supplier"; form: AiNewProduct }
  | { kind: "ai_new_supplier"; key: string; form: AiNewSupplier };

export type AiOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  checkStatus: "unchecked" | "all_here" | "problem";
  /** The supplier for a buyer, the buyer for a supplier. */
  counterparty: string;
  deliveryDate: string | null;
  placedAt: string;
  /** productId is missing on cards saved before part accept existed. */
  lines: { qty: number; name: string; unit: string; productId?: string }[];
  totalCents: number;
};

export type AiProduct = {
  /** Just added from a Tradelink AI form card. */
  added?: boolean;
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  supplier: string;
  /** Null while the supplier has not confirmed stock. */
  available: number | null;
  art: ArtKind;
  category: Category;
  inCart: number;
  /** A suggested quantity from the reorder plan; the person can change it before adding. */
  suggestedQty?: number;
  /** "1.3 days left", for items running low. */
  note?: string;
};

export type AiStock = {
  /** Just added from a Tradelink AI form card. */
  added?: boolean;
  id: string;
  name: string;
  sku: string;
  unit: string;
  priceCents: number;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  health: "healthy" | "low" | "out" | "unconfirmed";
};

export type AiProblem = {
  id: string;
  orderNumber: number;
  buyer: string;
  item: string;
  type: string;
  qty: number;
  amountCents: number;
  note: string | null;
};

export type AiAlert = {
  id: string;
  kind: "price" | "partial" | "reply" | "credit" | "date";
  title: string;
  detail: string;
  tone: "good" | "warn" | "bad";
};

export type AiCartLine = {
  /** Null while the line still needs a product chosen on the Cart page. */
  productId: string | null;
  name: string;
  qty: number;
  unit: string;
  supplier: string | null;
  lineCents: number | null;
  /** Stock free to order now; null when the supplier has not confirmed it yet. */
  available: number | null;
};

export type AiCart = {
  version: number;
  lines: AiCartLine[];
  totalCents: number;
  suppliers: number;
  /** Lines that still need a product chosen on the Cart page. */
  unresolved: number;
};

/** A form Tradelink AI fills in from the request; the person checks it and taps Add. */
export type AiNewProduct = {
  name: string;
  unit: string | null;
  priceCents: number | null;
  /** Buyer: the person's suppliers to choose from. */
  suppliers: { id: string; name: string }[];
  supplierId: string | null;
  /** Buyer: a supplier not on Tradelink yet, added together with the product. */
  newSupplier: string | null;
  /** Supplier: the category and stock to start with. */
  category: string | null;
  opening: number | null;
  reorder: number | null;
};

export type AiNewSupplier = { name: string; contact: string | null; phone: string | null };

export type AiSupplier = {
  name: string;
  /** Added by the buyer and not on Tradelink yet. */
  invited?: boolean;
  onTimePercent: number | null;
  deliveries: number;
  cutOff: string | null;
  deliveryDays: string | null;
};

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
  "Open settings",
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
