import type { CatalogueItem } from "@/domain/catalogue";
import { rankProducts, tokens } from "@/domain/reader/rules";

const MIN_WORD = 3;
const MIN_SHARE = 0.5;

function mentionScore(text: string, words: Set<string>, item: CatalogueItem): number {
  const aliases = item.aliases.map((alias) => alias.toLowerCase().trim()).filter((alias) => alias.length >= MIN_WORD);
  if (aliases.some((alias) => text.includes(alias))) return 1;
  const nameWords = tokens(item.name).filter((word) => word.length >= MIN_WORD);
  if (nameWords.length === 0) return 0;
  return nameWords.filter((word) => words.has(word)).length / nameWords.length;
}

/**
 * Catalogue products a free-text question mentions, best first: an alias appears in the text, or
 * at least half of the product's name words do. Only products from the given catalogue are returned.
 */
export function productsNamedIn(message: string, catalogue: CatalogueItem[], limit: number): CatalogueItem[] {
  const text = message.toLowerCase();
  const words = new Set(tokens(text));
  return catalogue
    .map((item) => ({ item, score: mentionScore(text, words, item) }))
    .filter((candidate) => candidate.score >= MIN_SHARE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((candidate) => candidate.item);
}

/** The product a price question is about, or null when the catalogue has no match. */
export function findPriceProduct(query: string, catalogue: CatalogueItem[]): CatalogueItem | null {
  if (query === "") return null;
  return rankProducts(query, catalogue)[0]?.item ?? productsNamedIn(query, catalogue, 1)[0] ?? null;
}
