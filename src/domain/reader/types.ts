export type LineState = "matched" | "check" | "not_found";

export type ReadLine = {
  sourceText: string; // the original line text (trimmed, ≤ 240 chars)
  productId: string | null; // only IDs from the catalogue passed in
  qty: number; // whole number ≥ 1
  qtyAssumed: boolean; // true when the text had no quantity
  kg: number | null; // weight asked for, when the order was in kg and the product has packKg
  options: string[]; // candidate product IDs, best first (max 5)
  state: LineState;
};

export type ReadResult = {
  lines: ReadLine[];
  readBy: "ai" | "rules";
  requestedDeliveryDate: string | null;
  note: string | null;
};
