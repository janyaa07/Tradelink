import { describe, expect, it } from "vitest";
import type { CatalogueItem, Unit } from "@/domain/catalogue";
import {
  groundExtractedOrder,
  groundRequestedDate,
  hasOrderQuantity,
  hasOrderUnit,
  normalizeUnit,
  relativeDeliveryDate,
  type ExtractedLine,
  type ExtractedOrder,
} from "./grounding";

function product(id: string, name: string, unit: Unit, aliases: string[], packKg: number | null = null): CatalogueItem {
  return {
    id,
    supplierOrgId: "s1",
    supplierName: "Harbour Dry Goods",
    sku: id.toUpperCase(),
    name,
    unit,
    price: "1.00",
    category: "dry_goods",
    art: "sack",
    packKg,
    reorderLevel: 5,
    aliases,
    status: "active",
    onHand: 50,
    reserved: 0,
    available: 50,
    health: "healthy",
  };
}

const rice = product("rice", "Rice 25kg", "bag", ["rice"]);
const jasmine = product("jasmine", "Jasmine rice 5kg", "bag", ["jasmine rice", "jasmine"], 5);
const spring = product("spring", "Spring onion 1kg", "bag", ["spring onion"], 1);
const cooking = product("cooking", "Cooking oil 2L", "bottle", ["cooking oil", "vegetable oil"]);
const sesame = product("sesame", "Sesame oil 630ml", "bottle", ["sesame oil"]);
const eggs = product("eggs", "Fresh eggs, 300 pieces", "carton", ["eggs", "egg"]);
const tofu = product("tofu", "Firm tofu 300g", "pack", ["tofu", "firm tofu"]);
const catalogue = [rice, jasmine, spring, cooking, sesame, eggs, tofu];

/** Monday 12 October 2026, 11:00 in Singapore. */
const now = new Date("2026-10-12T03:00:00Z");

function line(sourceText: string, productId: string | null, quantity: number | null, unit: string | null): ExtractedLine {
  return { sourceText, productId, quantity, unit, uncertain: false };
}

function order(lines: ExtractedLine[], extra: Partial<ExtractedOrder> = {}): ExtractedOrder {
  return { requestedDeliveryDate: null, deliveryNote: "", lines, unmatched: [], ...extra };
}

function ground(text: string, extracted: ExtractedOrder, items: CatalogueItem[] = catalogue) {
  return groundExtractedOrder(text, extracted, items, now);
}

describe("groundExtractedOrder: quantities and units need evidence", () => {
  it("rejects a quantity that only appears inside the product name", () => {
    const result = ground("order Rice 25kg", order([line("Rice 25kg", "rice", 25, "bag")], { requestedDeliveryDate: "2026-10-13" }));
    expect(result.lines[0]).toMatchObject({ productId: "rice", qty: 1, qtyAssumed: true, state: "check" });
    expect(result.requestedDeliveryDate).toBeNull();
  });

  it("rejects a spaced pack size inside the product name", () => {
    const result = ground("order Rice 25 kg", order([line("Rice 25 kg", "rice", 25, "kg")]));
    expect(result.lines[0]).toMatchObject({ qty: 1, qtyAssumed: true, kg: null, state: "check" });
  });

  it("accepts a written quantity and unit", () => {
    const result = ground("rice 2 bags tomorrow", order([line("rice 2 bags", "rice", 2, "bags")]));
    expect(result.lines[0]).toMatchObject({ productId: "rice", qty: 2, qtyAssumed: false, state: "matched" });
  });

  it("rounds a supported decimal quantity up", () => {
    const result = ground("rice 1.5 bags tomorrow", order([line("rice 1.5 bags", "rice", 1.5, "bags")]));
    expect(result.lines[0]).toMatchObject({ qty: 2, qtyAssumed: false, state: "matched" });
  });

  it("accepts number words and 'a bag'", () => {
    expect(ground("one bag of rice", order([line("one bag of rice", "rice", 1, "bag")])).lines[0]).toMatchObject({ qty: 1, qtyAssumed: false, state: "matched" });
    expect(ground("a bag of rice", order([line("a bag of rice", "rice", 1, "bag")])).lines[0]).toMatchObject({ qty: 1, qtyAssumed: false, state: "matched" });
    expect(ground("three ctn eggs", order([line("three ctn eggs", "eggs", 3, "ctn")])).lines[0]).toMatchObject({ qty: 3, state: "matched" });
  });

  it("treats a quantity the buyer never wrote as assumed and asks to check", () => {
    const result = ground("eggs", order([line("eggs", "eggs", 4, null)]));
    expect(result.lines[0]).toMatchObject({ productId: "eggs", qty: 1, qtyAssumed: true, state: "check" });
  });

  it("keeps a line without a quantity matched with an assumed quantity of 1", () => {
    const result = ground("tofu", order([line("tofu", "tofu", null, null)]));
    expect(result.lines[0]).toMatchObject({ productId: "tofu", qty: 1, qtyAssumed: true, state: "matched" });
  });

  it("asks to check when the model drops a quantity that is written", () => {
    const result = ground("tofu 3", order([line("tofu 3", "tofu", null, null)]));
    expect(result.lines[0]).toMatchObject({ qty: 1, qtyAssumed: true, state: "check" });
  });

  it("asks to check a unit that is not in the text", () => {
    const result = ground("eggs 2", order([line("eggs 2", "eggs", 2, "carton")]));
    expect(result.lines[0]).toMatchObject({ qty: 2, state: "check" });
  });

  it("accepts a short form of the product's unit and flags a different pack", () => {
    expect(ground("2 ctn eggs", order([line("2 ctn eggs", "eggs", 2, "ctn")])).lines[0]?.state).toBe("matched");
    expect(ground("2 boxes eggs", order([line("2 boxes eggs", "eggs", 2, "boxes")])).lines[0]?.state).toBe("check");
  });

  it("reads 'x2' and '2x' as quantities", () => {
    expect(ground("tofu x2", order([line("tofu x2", "tofu", 2, null)])).lines[0]).toMatchObject({ qty: 2, state: "matched" });
    expect(ground("2x tofu", order([line("2x tofu", "tofu", 2, null)])).lines[0]).toMatchObject({ qty: 2, state: "matched" });
  });
});

describe("groundExtractedOrder: kilograms", () => {
  it("converts a written weight into whole packs", () => {
    const result = ground("10kg jasmine rice", order([line("10kg jasmine rice", "jasmine", 10, "kg")]));
    expect(result.lines[0]).toMatchObject({ productId: "jasmine", qty: 2, kg: 10, state: "matched" });
  });

  it("accepts a spelled-out weight unit", () => {
    const result = ground("spring onion 3 kilograms", order([line("spring onion 3 kilograms", "spring", 3, "kilograms")]));
    expect(result.lines[0]).toMatchObject({ qty: 3, kg: 3, state: "matched" });
  });

  it("asks to check a weight for a product without a pack weight", () => {
    const result = ground("3kg tofu", order([line("3kg tofu", "tofu", 3, "kg")]));
    expect(result.lines[0]).toMatchObject({ productId: "tofu", qty: 3, kg: null, state: "check" });
  });
});

describe("groundExtractedOrder: products", () => {
  it("drops an unknown product id", () => {
    const result = ground("2 bags flour", order([line("2 bags flour", "not-in-catalogue", 2, "bags")]));
    expect(result.lines[0]).toMatchObject({ productId: null, state: "not_found" });
  });

  it("recovers a product the model missed when the line names it uniquely", () => {
    const result = ground("rice 2 bags tomorrow", order([{ ...line("rice 2 bags", null, 2, "bags"), uncertain: false }]), [rice]);
    expect(result.lines[0]).toMatchObject({ productId: "rice", qty: 2, state: "matched" });
  });

  it("does not choose between two products that share the written name", () => {
    const rival = product("rival", "Rice 50kg", "bag", ["rice"]);
    const result = ground("rice 2 bags", order([line("rice 2 bags", null, 2, "bags")]), [rice, rival]);
    expect(result.lines[0]).toMatchObject({ productId: null, state: "check", options: ["rice", "rival"] });
  });

  it("asks to check the model's pick when the line does not name it", () => {
    const result = ground("oil x 2", order([line("oil x 2", "cooking", 2, null)]));
    expect(result.lines[0]).toMatchObject({ productId: "cooking", qty: 2, state: "check" });
    expect(result.lines[0]?.options).toEqual(["cooking", "sesame"]);
  });

  it("asks to check a pick that contradicts the product the buyer named", () => {
    const result = ground("2 bottles sesame oil", order([line("2 bottles sesame oil", "cooking", 2, "bottles")]));
    expect(result.lines[0]).toMatchObject({ productId: "cooking", state: "check" });
    expect(result.lines[0]?.options).toContain("sesame");
  });

  it("asks to check whatever the model marked uncertain", () => {
    const result = ground("2 ctn eggs", order([{ ...line("2 ctn eggs", "eggs", 2, "ctn"), uncertain: true }]));
    expect(result.lines[0]?.state).toBe("check");
  });
});

describe("groundExtractedOrder: nothing invented, nothing lost", () => {
  it("discards a line whose text is not in the message and re-reads the real text", () => {
    const result = ground("2 ctn eggs", order([line("5 bags sugar", "rice", 5, "bags")]));
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ sourceText: "2 ctn eggs", productId: "eggs", qty: 2, state: "check" });
  });

  it("turns unmatched text that names a product into a check line", () => {
    const result = ground("order rice", order([], { unmatched: ["rice"] }), [rice]);
    expect(result.lines).toEqual([
      { sourceText: "rice", productId: "rice", qty: 1, qtyAssumed: true, kg: null, options: ["rice"], state: "check" },
    ]);
  });

  it("re-reads the whole message when the model returns nothing", () => {
    const result = ground("order rice", order([]), [rice]);
    expect(result.lines[0]).toMatchObject({ productId: "rice", state: "check" });
  });

  it("keeps unmatched requests as not found", () => {
    const result = ground("2 ctn eggs\n2 bottles dish soap", order([line("2 ctn eggs", "eggs", 2, "ctn")], { unmatched: ["2 bottles dish soap"] }));
    expect(result.lines.map((read) => [read.sourceText, read.state])).toEqual([
      ["2 ctn eggs", "matched"],
      ["2 bottles dish soap", "not_found"],
    ]);
  });

  it("recovers a line the model skipped", () => {
    const result = ground("2 ctn eggs\n5 packs tofu", order([line("2 ctn eggs", "eggs", 2, "ctn")]));
    expect(result.lines.map((read) => [read.productId, read.qty, read.state])).toEqual([
      ["eggs", 2, "matched"],
      ["tofu", 5, "check"],
    ]);
  });

  it("does not duplicate unmatched text already covered by a line", () => {
    const result = ground("2 ctn eggs", order([line("2 ctn eggs", "eggs", 2, "ctn")], { unmatched: ["eggs"] }));
    expect(result.lines).toHaveLength(1);
  });

  it("ignores greeting and thanks segments", () => {
    const result = ground("Hi, need for tomorrow:\n2 ctn eggs\nThanks!", order([line("2 ctn eggs", "eggs", 2, "ctn")]));
    expect(result.lines).toHaveLength(1);
  });

  it("labels the result as an AI reading and trims the note", () => {
    const result = ground("2 ctn eggs", order([line("2 ctn eggs", "eggs", 2, "ctn")], { deliveryNote: `  ${"a".repeat(200)}  ` }));
    expect(result.readBy).toBe("ai");
    expect(result.note).toHaveLength(160);
    expect(ground("2 ctn eggs", order([], { deliveryNote: "   " })).note).toBeNull();
  });
});

describe("groundRequestedDate", () => {
  it("accepts tomorrow written in English, short forms, Malay and Chinese", () => {
    for (const text of ["rice tomorrow", "rice tmr", "rice esok", "明天 rice"]) {
      expect(groundRequestedDate(text, "2026-10-13", now)).toBe("2026-10-13");
    }
  });

  it("rejects a date that contradicts tomorrow or today", () => {
    expect(groundRequestedDate("rice 2 bags tomorrow", "2026-10-14", now)).toBeNull();
    expect(groundRequestedDate("rice today", "2026-10-13", now)).toBeNull();
  });

  it("rejects a date when the message has no date cue", () => {
    expect(groundRequestedDate("order Rice 25kg", "2026-10-13", now)).toBeNull();
  });

  it("checks weekdays and ISO dates", () => {
    expect(groundRequestedDate("deliver on wed", "2026-10-14", now)).toBe("2026-10-14");
    expect(groundRequestedDate("deliver on wed", "2026-10-15", now)).toBeNull();
    expect(groundRequestedDate("deliver 2026-10-20", "2026-10-21", now)).toBeNull();
  });

  it("rejects impossible, past and far-future dates", () => {
    expect(groundRequestedDate("deliver 30/2", "2027-02-30", now)).toBeNull();
    expect(groundRequestedDate("deliver fri", "2026-10-09", now)).toBeNull();
    expect(groundRequestedDate("deliver 2027-06-01", "2027-06-01", now)).toBeNull();
  });

  it("uses the Singapore calendar date, not UTC", () => {
    const justAfterMidnight = new Date("2026-10-12T16:30:00Z");
    expect(groundRequestedDate("rice tomorrow", "2026-10-14", justAfterMidnight)).toBe("2026-10-14");
    expect(relativeDeliveryDate("rice tomorrow", justAfterMidnight)).toBe("2026-10-14");
  });

  it("reads only clear today or tomorrow cues for the rules fallback", () => {
    expect(relativeDeliveryDate("need for today", now)).toBe("2026-10-12");
    expect(relativeDeliveryDate("rice please", now)).toBeNull();
  });
});

describe("evidence helpers", () => {
  it("normalises unit spellings", () => {
    expect(["kgs", "kilograms", "KG"].map(normalizeUnit)).toEqual(["kg", "kg", "kg"]);
    expect(["ctns", "cartons", "carton"].map(normalizeUnit)).toEqual(["carton", "carton", "carton"]);
    expect(["cans", "tin", "boxes", "pkts", "pack"].map(normalizeUnit)).toEqual(["tin", "tin", "box", "packet", "packet"]);
  });

  it("finds quantities and units only outside the product name", () => {
    expect(hasOrderQuantity("Rice 25kg", 25, rice)).toBe(false);
    expect(hasOrderQuantity("Rice 25kg 2 bags", 2, rice)).toBe(true);
    expect(hasOrderQuantity("rice", 0, rice)).toBe(false);
    expect(hasOrderUnit("kangkong 10 kilograms", "kg")).toBe(true);
    expect(hasOrderUnit("Rice 25kg", "kg", rice)).toBe(false);
  });
});
