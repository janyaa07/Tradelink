import { describe, expect, it } from "vitest";
import { parseReply, plainReply } from "./reply-blocks";

describe("parseReply", () => {
  it("puts each card right after the sentence it belongs to", () => {
    const { blocks } = parseReply("Two orders arrive today.\n[[ORD-1061]]\n[[ORD-1058]]\nBoth are paid on delivery.", false);
    expect(blocks).toEqual([
      { kind: "text", text: "Two orders arrive today." },
      { kind: "card", key: "ORD-1061" },
      { kind: "card", key: "ORD-1058" },
      { kind: "text", text: "Both are paid on delivery." },
    ]);
  });

  it("handles a tag written at the end of a sentence and shows each card once", () => {
    const { blocks } = parseReply("Here is your cart [[CART]] and again [[CART]]", false);
    expect(blocks).toEqual([
      { kind: "text", text: "Here is your cart and again" },
      { kind: "card", key: "CART" },
    ]);
  });

  it("turns dash lines into a list", () => {
    const { blocks } = parseReply("Low on:\n- Ginger\n- Turmeric", false);
    expect(blocks).toEqual([
      { kind: "text", text: "Low on:" },
      { kind: "list", items: ["Ginger", "Turmeric"] },
    ]);
  });

  it("pulls out suggested follow-ups", () => {
    const { blocks, asks } = parseReply("Done.\n[[ask:Accept all new orders]]\n[[ask:What is low in stock?]]", false);
    expect(asks).toEqual(["Accept all new orders", "What is low in stock?"]);
    expect(blocks).toEqual([{ kind: "text", text: "Done." }]);
  });

  it("hides a half-written tag while the answer is still arriving", () => {
    expect(parseReply("Two orders today.\n[[ORD-10", true).blocks).toEqual([{ kind: "text", text: "Two orders today." }]);
    expect(parseReply("Two orders today.\n[[ORD-10", false).blocks).toEqual([{ kind: "text", text: "Two orders today. [[ORD-10" }]);
  });

  it("keeps card tags but drops follow-ups from the words sent back to the model", () => {
    expect(plainReply("Here.\n[[ORD-1061]]\n[[ask:More]]")).toBe("Here.\n[[ORD-1061]]");
  });
});
