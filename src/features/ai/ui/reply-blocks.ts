/** Pieces of a Tradelink AI answer, in the order the answer gives them. */
export type ReplyBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "card"; key: string };

const CARD_TAG = /\[\[([A-Za-z][A-Za-z0-9-]{0,19})\]\]/g;
const ASK_TAG = /\[\[ask:([^\]\n]{2,90})\]\]/g;
const LIST_ITEM = /^\s*[-*•]\s+/;

/**
 * Splits the answer into paragraphs, lists and card tags such as [[ORD-1061]], and pulls out the
 * suggested follow-ups ([[ask:...]]). While the answer is still arriving, a half-written tag at the
 * end is hidden instead of flashing up as text.
 */
export function parseReply(raw: string, streaming: boolean): { blocks: ReplyBlock[]; asks: string[] } {
  let text = raw;
  if (streaming) {
    const open = text.lastIndexOf("[[");
    if (open !== -1 && !text.slice(open).includes("]]")) text = text.slice(0, open);
  }
  const asks = [...text.matchAll(ASK_TAG)].map((match) => (match[1] ?? "").trim()).filter(Boolean);
  text = text.replace(ASK_TAG, "");

  const blocks: ReplyBlock[] = [];
  const seenCards = new Set<string>();
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "text", text: paragraph.join(" ") });
    if (list.length > 0) blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };

  for (const line of text.split("\n")) {
    const keys = [...line.matchAll(CARD_TAG)].map((match) => match[1] ?? "");
    const words = line.replace(CARD_TAG, "").replace(/\s+/g, " ").trim();
    if (words === "" && keys.length === 0) {
      flush();
      continue;
    }
    if (words !== "") {
      if (LIST_ITEM.test(words)) {
        if (paragraph.length > 0) {
          blocks.push({ kind: "text", text: paragraph.join(" ") });
          paragraph = [];
        }
        list.push(words.replace(LIST_ITEM, ""));
      } else {
        if (list.length > 0) {
          blocks.push({ kind: "list", items: list });
          list = [];
        }
        paragraph.push(words);
      }
    }
    if (keys.length > 0) {
      flush();
      for (const key of keys) {
        if (seenCards.has(key)) continue;
        seenCards.add(key);
        blocks.push({ kind: "card", key });
      }
    }
  }
  flush();
  return { blocks, asks: asks.slice(0, 3) };
}

/** The answer as plain words, for the history sent back to the model on the next turn. */
export function plainReply(raw: string): string {
  return raw.replace(ASK_TAG, "").replace(/\n{3,}/g, "\n\n").trim();
}
