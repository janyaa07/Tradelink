/**
 * Deterministic intent router for Tradelink Assistant (BUY-48, BUY-50.1). Ports the prototype's reply() rules,
 * checked in the same order, so common questions never need the model.
 */
export type AskIntent =
  | { kind: "other_shops" }
  | { kind: "order_number"; number: number }
  | { kind: "spend" }
  | { kind: "deliveries" }
  | { kind: "restock" }
  | { kind: "usual" }
  | { kind: "reliability" }
  | { kind: "price"; query: string }
  | { kind: "none" };

const OTHER_SHOPS =
  /\b(?:other|another|competitors?'?|rival)\s+(?:shops?|stores?|stalls?|buyers?|customers?|businesse?s?|restaurants?|outlets?)\b|\beveryone'?s\b|\ball\s+(?:the\s+)?(?:shops|buyers|customers|businesses)\b/;
const ORDER_NUMBER = /\bord(?:er)?\s*(?:-|#|no\.?|number)\s*#?\s*(\d{1,12})\b|\bord\s*(\d{1,12})\b/;
const SPEND = /\bspen[dt]|\bspending\b|\bbudget/;
const DELIVERIES = /\barriv|\bdeliver|\bcoming\b|\bon the way\b/;
const RESTOCK = /\brunning low\b|\bwhat should i (?:re)?order\b|\bneed to order\b|\bwhat do i need\b|\blow\b/;
const USUAL = /\busual\b|\breorder\b|\bsame as\b/;
const RELIABILITY = /\breliab|\bon time\b|\bbest supplier\b|\blate\b/;
const SUPPLIER = /\bsuppliers?\b/;
const PRICE = /\bprices?\b|\bhow much\b|\bcosts?\b/;

/** Longer phrases first, so "what's" is removed whole rather than leaving "s". */
const PRICE_FILLER =
  /\b(?:how much|right now|these days|what's|whats|what|prices?|costs?|currently|today|does|now|per|for|my|your|is|are|was|of|the|an|a|do)\b/g;
const QUESTION_START =
  /^(?:what|what's|whats|how|which|when|where|why|who|is|are|was|were|do|does|did|can|could|should|will|would|any|tell|show|list|explain)\b/;
const QUANTITY = /\b\d+(?:\.\d+)?\s*(?:x\b|[a-z])/;

function normalise(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

/** The product words left in a price question: "How much is cooking oil?" gives "cooking oil". */
export function priceQuery(text: string): string {
  return normalise(text)
    .replace(PRICE_FILLER, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A question rather than an order: ends with "?" or starts with a question word. */
export function isQuestion(message: string): boolean {
  const text = normalise(message);
  return text.endsWith("?") || QUESTION_START.test(text);
}

export function routeIntent(message: string): AskIntent {
  const text = normalise(message);
  if (OTHER_SHOPS.test(text)) return { kind: "other_shops" };
  const order = ORDER_NUMBER.exec(text);
  const digits = order?.[1] ?? order?.[2];
  if (digits) return { kind: "order_number", number: Number(digits) };
  if (SPEND.test(text)) return { kind: "spend" };
  if (SUPPLIER.test(text) && RELIABILITY.test(text)) return { kind: "reliability" };
  if (DELIVERIES.test(text)) {
    // "2 ctn eggs, deliver before 9am" is an order, not a delivery question.
    return isQuestion(text) || !QUANTITY.test(text) ? { kind: "deliveries" } : { kind: "none" };
  }
  if (RESTOCK.test(text)) return { kind: "restock" };
  if (USUAL.test(text)) return { kind: "usual" };
  if (RELIABILITY.test(text)) return { kind: "reliability" };
  if (PRICE.test(text)) return { kind: "price", query: priceQuery(text) };
  return { kind: "none" };
}

/**
 * Whether a message with no intent should go to the order reader: not a question, and it has a
 * quantity or the rule-based reader found a catalogue product in it.
 */
export function readsAsOrder(message: string, rulesFoundProduct: boolean): boolean {
  if (isQuestion(message)) return false;
  return QUANTITY.test(normalise(message)) || rulesFoundProduct;
}
