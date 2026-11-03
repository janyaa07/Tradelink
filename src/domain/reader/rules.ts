import type { CatalogueItem } from "@/domain/catalogue";
import type { ReadLine, ReadResult } from "./types";

/** Pack words a buyer types next to a quantity. */
const UNIT_PATTERN = "ctns?|cartons?|box(?:es)?|bags?|btls?|bottles?|tins?|cans?|pkts?|packets?|packs?|tubs?|trays?|kgs?";
const QUANTITY_PATTERN = new RegExp(`(?:\\bx\\s*)?(\\d+(?:\\.\\d+)?)\\s*(x\\b|(?:${UNIT_PATTERN})\\b)?`);
const UNIT_WORDS = new RegExp(`\\b(?:${UNIT_PATTERN})\\b`, "g");
const FILLER_WORDS =
  /\b(?:hi|hello|hey|pls|please|need|want|abt|about|around|of|for|tomorrow|morning|today|thanks|thank you|the|some)\b/g;
const LINE_BREAKS = /\n|,|;|\band\b|&/i;

const ALIAS_SCORE = 1;
const TOKEN_SCORE_WEIGHT = 0.9;
const CANDIDATE_THRESHOLD = 0.45;
const MATCH_THRESHOLD = 0.85;
export const MAX_OPTIONS = 5;
export const MAX_SOURCE_TEXT = 240;

export type ProductScore = { item: CatalogueItem; score: number };

type QuantityReading = { amount: number; unit: string; assumed: boolean; rest: string };

/** Lower-cases a word, strips punctuation and a plural "s" on words longer than three letters. */
export function normaliseWord(word: string): string {
  const plain = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  return plain.length > 3 && plain.endsWith("s") ? plain.slice(0, -1) : plain;
}

/** Name words used for matching; words containing digits (sizes such as "5kg") are ignored. */
export function tokens(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map(normaliseWord)
    .filter((word) => word !== "" && !/\d/.test(word));
}

/** Whole packs needed to cover a weight, never fewer than one. */
export function packsForWeight(kg: number, packKg: number): number {
  return Math.max(1, Math.ceil(kg / packKg - 1e-9));
}

export function trimSourceText(text: string): string {
  return text.trim().slice(0, MAX_SOURCE_TEXT);
}

function scoreProduct(query: string, queryTokens: string[], item: CatalogueItem): number {
  const aliases = item.aliases.map((alias) => alias.toLowerCase());
  if (aliases.some((alias) => alias !== "" && query.includes(alias))) return ALIAS_SCORE;
  const productTokens = new Set([...tokens(item.name), ...aliases.flatMap(tokens)]);
  const shared = queryTokens.filter((token) => productTokens.has(token)).length;
  return (shared / queryTokens.length) * TOKEN_SCORE_WEIGHT;
}

/** Catalogue products that plausibly match a cleaned query, best first. */
export function rankProducts(query: string, catalogue: CatalogueItem[]): ProductScore[] {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];
  return catalogue
    .map((item) => ({ item, score: scoreProduct(query, queryTokens, item) }))
    .filter((candidate) => candidate.score >= CANDIDATE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

function isClearWinner(ranked: ProductScore[]): boolean {
  const [top, next] = ranked;
  if (!top || top.score < MATCH_THRESHOLD) return false;
  return !next || next.score !== top.score;
}

function readQuantity(text: string): QuantityReading {
  const match = text.match(QUANTITY_PATTERN);
  if (!match || match[1] === undefined) return { amount: 1, unit: "", assumed: true, rest: text };
  return { amount: parseFloat(match[1]), unit: match[2] ?? "", assumed: false, rest: text.replace(match[0], " ") };
}

function cleanQuery(text: string): string {
  return text
    .replace(UNIT_WORDS, " ")
    .replace(FILLER_WORDS, " ")
    .replace(/\bx\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDecoration(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[-*\s]+/, "")
    .replace(/[.!:]+$/g, "");
}

/**
 * Sets the product on a line. When the buyer asked by weight and the product has a pack
 * weight, the quantity becomes whole packs; otherwise the weight cannot be converted and is dropped.
 */
export function withProduct(line: ReadLine, item: CatalogueItem): ReadLine {
  if (line.kg === null) return { ...line, productId: item.id };
  if (item.packKg) return { ...line, productId: item.id, qty: packsForWeight(line.kg, item.packKg) };
  return { ...line, productId: item.id, kg: null };
}

function chooseBest(line: ReadLine, item: CatalogueItem): ReadLine {
  const chosen = withProduct(line, item);
  const weightLost = line.kg !== null && chosen.kg === null;
  return { ...chosen, state: weightLost ? "check" : "matched" };
}

/** Reads one typed line; returns null when nothing but filler, units or numbers remain. */
export function readLineWithRules(raw: string, catalogue: CatalogueItem[]): ReadLine | null {
  const quantity = readQuantity(stripDecoration(raw));
  const query = cleanQuery(quantity.rest);
  if (query === "") return null;
  const ranked = rankProducts(query, catalogue);
  const line: ReadLine = {
    sourceText: trimSourceText(raw),
    productId: null,
    qty: Math.max(1, Math.ceil(quantity.amount)),
    qtyAssumed: quantity.assumed,
    kg: /^kg/.test(quantity.unit) ? quantity.amount : null,
    options: ranked.slice(0, MAX_OPTIONS).map((candidate) => candidate.item.id),
    state: ranked.length > 0 ? "check" : "not_found",
  };
  const top = ranked[0];
  return top && isClearWinner(ranked) ? chooseBest(line, top.item) : line;
}

/** Splits an informal order on new lines, commas, semicolons, "and" and "&". */
export function splitOrderText(text: string): string[] {
  return text.split(LINE_BREAKS);
}

/** Rule-based reader: matches each typed line against the buyer's catalogue only. */
export function readOrderWithRules(text: string, catalogue: CatalogueItem[]): ReadResult {
  const lines = splitOrderText(text)
    .map((raw) => readLineWithRules(raw, catalogue))
    .filter((line): line is ReadLine => line !== null);
  return { lines, readBy: "rules", requestedDeliveryDate: null, note: null };
}
