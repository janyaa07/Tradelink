import { describe, expect, it } from "vitest";
import {
  conversationTitle,
  MAX_CONVERSATIONS,
  parseConversations,
  relativeDay,
  upsertConversation,
  type ChatMessage,
  type Conversation,
} from "./history";

function message(id: number, from: ChatMessage["from"], text: string): ChatMessage {
  return { id, from, reply: { text, cards: [], actions: [] }, done: false };
}

function conversation(id: string, updatedAt: string): Conversation {
  return { id, title: id, updatedAt, messages: [message(1, "buyer", id)] };
}

describe("conversationTitle", () => {
  it("uses the first buyer message on one line", () => {
    expect(conversationTitle([message(1, "tradelink", "Hello"), message(2, "buyer", "2 ctn eggs\nand rice")])).toBe(
      "2 ctn eggs and rice",
    );
    expect(conversationTitle([message(1, "buyer", "  what is   in my cart  ")])).toBe("what is in my cart");
    expect(conversationTitle([])).toBe("New chat");
  });

  it("shortens a long first message", () => {
    const title = conversationTitle([message(1, "buyer", "a".repeat(100))]);
    expect(title).toHaveLength(60);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("upsertConversation", () => {
  const now = new Date("2026-11-03T10:00:00Z");

  it("puts the open chat first with its new messages", () => {
    const saved = [conversation("a", "2026-11-03T09:00:00Z"), conversation("b", "2026-11-02T09:00:00Z")];
    const result = upsertConversation(saved, "b", [message(1, "buyer", "rice"), message(2, "tradelink", "ok")], now);
    expect(result.map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(result[0]).toMatchObject({ title: "rice", updatedAt: now.toISOString() });
    expect(result[0]?.messages).toHaveLength(2);
  });

  it("keeps at most the newest conversations", () => {
    const saved = Array.from({ length: MAX_CONVERSATIONS }, (_, index) => conversation(`c${index}`, now.toISOString()));
    const result = upsertConversation(saved, "new", [message(1, "buyer", "hi")], now);
    expect(result).toHaveLength(MAX_CONVERSATIONS);
    expect(result[0]?.id).toBe("new");
    expect(result.some((entry) => entry.id === `c${MAX_CONVERSATIONS - 1}`)).toBe(false);
  });
});

describe("parseConversations", () => {
  it("keeps valid chats newest first and drops anything malformed", () => {
    const older = conversation("a", "2026-11-01T00:00:00Z");
    const newer = conversation("b", "2026-11-02T00:00:00Z");
    const raw = JSON.stringify([older, { id: "bad", messages: "nope" }, newer, 5]);
    expect(parseConversations(raw).map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("drops a chat whose link leaves the buyer area", () => {
    const linked: Conversation = {
      ...conversation("a", "2026-11-01T00:00:00Z"),
      messages: [
        {
          ...message(1, "tradelink", "x"),
          reply: { text: "x", cards: [], actions: [{ kind: "link", label: "View cart", href: "https://example.com" }] },
        },
      ],
    };
    expect(parseConversations(JSON.stringify([linked]))).toEqual([]);
  });

  it("gives an empty list for missing or broken storage", () => {
    expect(parseConversations(null)).toEqual([]);
    expect(parseConversations("{not json")).toEqual([]);
    expect(parseConversations(JSON.stringify({ a: 1 }))).toEqual([]);
  });
});

describe("relativeDay", () => {
  const now = new Date("2026-11-03T10:00:00+08:00");

  it("says Today, Yesterday or the date, in Singapore time", () => {
    expect(relativeDay("2026-11-03T00:30:00+08:00", now)).toBe("Today");
    expect(relativeDay("2026-11-02T23:30:00+08:00", now)).toBe("Yesterday");
    expect(relativeDay("2026-10-28T12:00:00+08:00", now)).toBe("28 Oct");
    expect(relativeDay("not a date", now)).toBe("");
  });
});
