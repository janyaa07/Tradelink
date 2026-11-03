import type { CatalogueItem } from "@/domain/catalogue";
import { MAX_OPTIONS, readLineWithRules, splitOrderText, trimSourceText, withProduct, type ProductScore } from "./rules";
import type { LineState, ReadLine, ReadResult } from "./types";

/** One line as the model proposed it, before it is checked against the buyer's words. */
export type ExtractedLine = {
  productId: string | null;
  quantity: number | null;
  unit: string | null;
  sourceText: string;
  uncertain: boolean;
};

/** The model's proposed reading of a whole order. */
export type ExtractedOrder = {
  requestedDeliveryDate: string | null;
  deliveryNote: string;
  lines: ExtractedLine[];
  unmatched: string[];
};

const SINGAPORE_TIME_ZONE = "Asia/Singapore";
const DAY_MS = 86_400_000;
const MAX_DAYS_AHEAD = 90;
const MAX_NOTE_LENGTH = 160;

const DATE_CUE =
  /\b(?:today|tdy|tomorrow|tmr|tmrw|esok|hari ini|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b|明天|今天|நாளை|இன்று/i;
const TOMORROW_CUE = /\b(?:tomorrow|tmr|tmrw|esok)\b|明天|நாளை/i;
const TODAY_CUE = /\b(?:today|tdy|hari ini)\b|今天|இன்று/i;
const ISO_DATE = /\b20\d{2}-\d{2}-\d{2}\b/;
const WEEKDAY = /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
const WEEKDAY_PREFIXES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];
const SINGLE_PACK =
  /\b(?:a|an)\s+(?:bag|sack|carton|ctn|box|tin|can|bottle|tray|tub|pack|packet|case|bundle|kg|kilo|piece|pc)\b/i;
const WRITTEN_NUMBER = /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|\p{L}|$)/gu;

const UNIT_SYNONYMS: Record<string, string> = {
  kilogram: "kg",
  kilo: "kg",
  gram: "g",
  litre: "l",
  liter: "l",
  ltr: "l",
  piece: "pc",
  each: "pc",
  ctn: "carton",
  btl: "bottle",
  pkt: "packet",
  pack: "packet",
  boxe: "box",
  can: "tin",
  sack: "bag",
};

// ---------- Text normalisation ----------

/** Lower-case, Unicode-normalised text with every run of non letters/digits turned into one space. */
export function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Maps a spoken unit to one canonical word, so "ctns", "cartons" and "carton" compare equal. */
export function normalizeUnit(value: string): string {
  const unit = normalizeName(value).replace(/s$/, "");
  return UNIT_SYNONYMS[unit] ?? unit;
}

function containsWords(text: string, words: string): boolean {
  return words !== "" && ` ${text} `.includes(` ${words} `);
}

/** True when `fragment` is a word-aligned part of `text`, ignoring case and punctuation. */
function appearsIn(text: string, fragment: string): boolean {
  return containsWords(normalizeName(text), normalizeName(fragment));
}

/** Like normalizeName, but keeps decimals and joins a number to the word after it ("10 kg" → "10kg"). */
function compactEvidence(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/×/g, "x")
    .replace(/\bx(?=\d)/g, "x ")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .trim()
    .replace(/(\d)\s+(?=\p{L})/gu, "$1");
}

function productNames(item: CatalogueItem): string[] {
  return [item.name, ...item.aliases];
}

/** The line's words with the product's own name removed, so "Rice 25kg" is not read as 25 of anything. */
function spokenEvidence(text: string, item?: CatalogueItem): string {
  const source = compactEvidence(text);
  if (!item) return source;
  const names = productNames(item)
    .map(compactEvidence)
    .sort((a, b) => b.length - a.length);
  const name = names.find((candidate) => containsWords(source, candidate));
  return name ? ` ${source} `.replace(` ${name} `, " ").trim() : source;
}

// ---------- Quantity and unit evidence ----------

function writtenNumbers(evidence: string): number[] {
  return [...evidence.matchAll(WRITTEN_NUMBER)].map((match) => Number(match[1]));
}

function isSpokenNumber(evidence: string, quantity: number): boolean {
  const word = Number.isInteger(quantity) ? NUMBER_WORDS[quantity] : undefined;
  return word !== undefined && containsWords(evidence, word);
}

/** True when the buyer's own words contain this quantity (digits, a number word, or "a bag"). */
export function hasOrderQuantity(text: string, quantity: number, item?: CatalogueItem): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0) return false;
  const evidence = spokenEvidence(text, item);
  if (writtenNumbers(evidence).includes(quantity)) return true;
  if (isSpokenNumber(evidence, quantity)) return true;
  return quantity === 1 && SINGLE_PACK.test(evidence);
}

/** True when the buyer's own words contain this unit, written alone or straight after a number. */
export function hasOrderUnit(text: string, unit: string, item?: CatalogueItem): boolean {
  const target = normalizeUnit(unit);
  if (target === "") return false;
  return spokenEvidence(text, item)
    .split(" ")
    .some((word) => normalizeUnit(word.replace(/^\d+(?:\.\d+)?/, "")) === target);
}

function mentionsNumber(text: string, item?: CatalogueItem): boolean {
  return /\d/.test(spokenEvidence(text, item));
}

// ---------- Delivery date ----------

/** Calendar date (YYYY-MM-DD) in Singapore. */
export function singaporeDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SINGAPORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 24-hour clock time (HH:mm) in Singapore. */
export function singaporeClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SINGAPORE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function hasOrderDateCue(text: string): boolean {
  return DATE_CUE.test(text);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function daysFrom(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS;
}

function weekdayPrefix(isoDate: string): string | undefined {
  return WEEKDAY_PREFIXES[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

/** "today" or "tomorrow" (and their short and translated forms) as a Singapore date. */
export function relativeDeliveryDate(text: string, now: Date): string | null {
  const saysTomorrow = TOMORROW_CUE.test(text);
  const saysToday = TODAY_CUE.test(text);
  if (saysTomorrow === saysToday) return null;
  return singaporeDate(saysTomorrow ? new Date(now.getTime() + DAY_MS) : now);
}

function agreesWithWrittenCues(text: string, proposed: string, now: Date): boolean {
  const relative = relativeDeliveryDate(text, now);
  if (relative && proposed !== relative) return false;
  const iso = text.match(ISO_DATE)?.[0];
  if (iso && proposed !== iso) return false;
  const weekday = text.match(WEEKDAY)?.[0]?.slice(0, 3).toLowerCase();
  return !weekday || weekdayPrefix(proposed) === weekday;
}

/**
 * Keeps the model's delivery date only when the message mentions a date, the date is real,
 * falls within the next 90 days in Singapore, and agrees with any today/tomorrow, ISO or weekday cue.
 */
export function groundRequestedDate(text: string, proposed: string | null, now: Date): string | null {
  if (!proposed || !hasOrderDateCue(text) || !isCalendarDate(proposed)) return null;
  const ahead = daysFrom(singaporeDate(now), proposed);
  if (ahead < 0 || ahead > MAX_DAYS_AHEAD) return null;
  return agreesWithWrittenCues(text, proposed, now) ? proposed : null;
}

// ---------- Product evidence ----------

/** Products whose full name or an alias is written in the line, longest name first. */
function rankByNamedEvidence(sourceText: string, catalogue: CatalogueItem[]): ProductScore[] {
  const spoken = normalizeName(sourceText);
  return catalogue
    .map((item) => ({
      item,
      score: Math.max(0, ...productNames(item).map(normalizeName).map((name) => (containsWords(spoken, name) ? name.length : 0))),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

function uniqueBest(ranked: ProductScore[]): CatalogueItem | null {
  const [top, next] = ranked;
  if (!top) return null;
  return !next || top.score > next.score ? top.item : null;
}

function candidateOptions(proposed: CatalogueItem | null, named: ProductScore[], sourceText: string, catalogue: CatalogueItem[]): string[] {
  const ids = [
    ...(proposed ? [proposed.id] : []),
    ...named.map((candidate) => candidate.item.id),
    ...(readLineWithRules(sourceText, catalogue)?.options ?? []),
  ];
  return [...new Set(ids)].slice(0, MAX_OPTIONS);
}

type ProductGrounding = { item: CatalogueItem | null; options: string[]; state: LineState };

function groundProduct(line: ExtractedLine, catalogue: CatalogueItem[]): ProductGrounding {
  const named = rankByNamedEvidence(line.sourceText, catalogue);
  const best = uniqueBest(named);
  const proposed = catalogue.find((item) => item.id === line.productId) ?? null;
  const options = candidateOptions(proposed, named, line.sourceText, catalogue);
  if (line.productId !== null && !proposed) return { item: null, options, state: "not_found" };
  if (best && (!proposed || proposed.id === best.id)) return { item: best, options, state: "matched" };
  if (proposed) return { item: proposed, options, state: "check" };
  return { item: null, options, state: options.length > 0 ? "check" : "not_found" };
}

// ---------- Quantity and unit grounding ----------

type QuantityGrounding = { amount: number | null; doubtful: boolean };

function groundQuantity(line: ExtractedLine, item: CatalogueItem | null): QuantityGrounding {
  const product = item ?? undefined;
  if (line.quantity === null) return { amount: null, doubtful: mentionsNumber(line.sourceText, product) };
  if (!hasOrderQuantity(line.sourceText, line.quantity, product)) return { amount: null, doubtful: true };
  return { amount: line.quantity, doubtful: false };
}

type UnitGrounding = { byWeight: boolean; doubtful: boolean };

function groundUnit(line: ExtractedLine, item: CatalogueItem | null): UnitGrounding {
  if (line.unit === null || line.unit.trim() === "") return { byWeight: false, doubtful: false };
  if (!hasOrderUnit(line.sourceText, line.unit, item ?? undefined)) return { byWeight: false, doubtful: true };
  const spoken = normalizeUnit(line.unit);
  if (spoken === "kg") return { byWeight: true, doubtful: false };
  return { byWeight: false, doubtful: item !== null && spoken !== normalizeUnit(item.unit) };
}

// ---------- Lines ----------

function groundLine(line: ExtractedLine, catalogue: CatalogueItem[]): ReadLine {
  const product = groundProduct(line, catalogue);
  const quantity = groundQuantity(line, product.item);
  const unit = groundUnit(line, product.item);
  const draft: ReadLine = {
    sourceText: trimSourceText(line.sourceText),
    productId: null,
    qty: quantity.amount === null ? 1 : Math.max(1, Math.ceil(quantity.amount)),
    qtyAssumed: quantity.amount === null,
    kg: unit.byWeight && quantity.amount !== null ? quantity.amount : null,
    options: product.options,
    state: product.state,
  };
  const read = product.item ? withProduct(draft, product.item) : draft;
  const weightLost = draft.kg !== null && read.kg === null;
  const doubtful = line.uncertain || quantity.doubtful || unit.doubtful || weightLost;
  return { ...read, state: doubtful && read.state === "matched" ? "check" : read.state };
}

function capAtCheck(line: ReadLine): ReadLine {
  return line.state === "matched" ? { ...line, state: "check" } : line;
}

function isCovered(segment: string, covered: string[]): boolean {
  const words = normalizeName(segment);
  return words === "" || covered.some((text) => containsWords(text, words) || containsWords(words, text));
}

/** Rule-based lines for text the model left unmatched or skipped, never better than "check". */
function readLeftovers(leftovers: string[], catalogue: CatalogueItem[]): ReadLine[] {
  return leftovers
    .map((raw) => readLineWithRules(raw, catalogue))
    .filter((line): line is ReadLine => line !== null)
    .map(capAtCheck);
}

function cleanNote(note: string): string | null {
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  return trimmed === "" ? null : trimmed;
}

/**
 * Checks the model's reading against the buyer's own message and catalogue:
 * - lines whose source text is not in the message are discarded (their text is re-read by rules);
 * - unknown product IDs become not_found; a product must be uniquely named in the line to stay matched;
 * - quantities and units must be written in the line, otherwise qty 1 (assumed) and "check";
 * - kilograms become whole packs when the product has a pack weight;
 * - text the model left unmatched or skipped is re-read by rules and capped at "check".
 */
export function groundExtractedOrder(
  text: string,
  extracted: ExtractedOrder,
  catalogue: CatalogueItem[],
  now: Date,
): ReadResult {
  const kept = extracted.lines.filter((line) => appearsIn(text, line.sourceText));
  const keptSources = kept.map((line) => normalizeName(line.sourceText));
  const unmatched = extracted.unmatched.filter((raw) => appearsIn(text, raw) && !isCovered(raw, keptSources));
  const covered = [...keptSources, ...unmatched.map(normalizeName)];
  const skipped = splitOrderText(text).filter((segment) => !isCovered(segment, covered));
  return {
    lines: [...kept.map((line) => groundLine(line, catalogue)), ...readLeftovers([...unmatched, ...skipped], catalogue)],
    readBy: "ai",
    requestedDeliveryDate: groundRequestedDate(text, extracted.requestedDeliveryDate, now),
    note: cleanNote(extracted.deliveryNote),
  };
}
