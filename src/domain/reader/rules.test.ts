import { describe, expect, it } from "vitest";
import type { CatalogueItem, Unit } from "@/domain/catalogue";
import {
  packsForWeight,
  rankProducts,
  readLineWithRules,
  readOrderWithRules,
  tokens,
  withProduct,
} from "./rules";
import { findSubstitute } from "./substitute";
import type { ReadLine } from "./types";

function product(
  id: string,
  name: string,
  unit: Unit,
  available: number,
  aliases: string[],
  packKg: number | null = null,
): CatalogueItem {
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
    onHand: available,
    reserved: 0,
    available,
    health: "healthy",
  };
}

/** Products p1 to p12 from the approved prototype. */
const catalogue: CatalogueItem[] = [
  product("p1", "Jasmine rice 5kg", "bag", 46, ["jasmine rice", "jasmine"], 5),
  product("p2", "Basmati rice 5kg", "bag", 18, ["basmati rice", "basmati"], 5),
  product("p3", "Cooking oil 2L", "bottle", 30, ["cooking oil", "vegetable oil"]),
  product("p4", "Sesame oil 630ml", "bottle", 9, ["sesame oil"]),
  product("p5", "Evaporated milk 390g", "tin", 120, ["evaporated milk", "evap milk"]),
  product("p6", "Dried noodles 400g", "packet", 64, ["noodles", "dried noodles"]),
  product("p7", "Tissue paper, 30 packs", "carton", 7, ["tissue paper", "tissue"]),
  product("p8", "Granulated sugar 2kg", "bag", 52, ["sugar"], 2),
  product("p9", "Fresh eggs, 300 pieces", "carton", 14, ["eggs", "egg"]),
  product("p10", "Chilli paste 1kg", "tub", 11, ["chilli paste", "sambal"]),
  product("p11", "Firm tofu 300g", "pack", 80, ["tofu", "firm tofu"]),
  product("p12", "Spring onion 1kg", "bag", 3, ["spring onion"], 1),
];

const SAMPLE = "Hi, need for tomorrow:\n2 ctn eggs\n10kg jasmine rice\n3 tins evaporated milk\noil x 2\n1 tub chilli paste\n2 bottles dish soap\nThanks!";

function readOne(text: string): ReadLine {
  const line = readLineWithRules(text, catalogue);
  if (!line) throw new Error(`Expected a line for "${text}"`);
  return line;
}

describe("readOrderWithRules: prototype sample", () => {
  const result = readOrderWithRules(SAMPLE, catalogue);

  it("drops greeting and thanks lines and keeps six item lines", () => {
    expect(result.lines.map((line) => line.sourceText)).toEqual([
      "2 ctn eggs",
      "10kg jasmine rice",
      "3 tins evaporated milk",
      "oil x 2",
      "1 tub chilli paste",
      "2 bottles dish soap",
    ]);
  });

  it("matches eggs with quantity 2", () => {
    expect(result.lines[0]).toMatchObject({ productId: "p9", qty: 2, qtyAssumed: false, kg: null, state: "matched" });
  });

  it("converts 10kg of jasmine rice into two 5kg bags", () => {
    expect(result.lines[1]).toMatchObject({ productId: "p1", qty: 2, kg: 10, state: "matched" });
    expect(result.lines[1]?.options[0]).toBe("p1");
  });

  it("matches 3 tins of evaporated milk", () => {
    expect(result.lines[2]).toMatchObject({ productId: "p5", qty: 3, state: "matched" });
  });

  it("asks to check a bare 'oil' between cooking oil and sesame oil", () => {
    expect(result.lines[3]).toMatchObject({ productId: null, qty: 2, qtyAssumed: false, state: "check" });
    expect(result.lines[3]?.options).toEqual(["p3", "p4"]);
  });

  it("matches 1 tub of chilli paste", () => {
    expect(result.lines[4]).toMatchObject({ productId: "p10", qty: 1, qtyAssumed: false, state: "matched" });
  });

  it("marks dish soap as not found", () => {
    expect(result.lines[5]).toMatchObject({ productId: null, qty: 2, options: [], state: "not_found" });
  });

  it("is labelled as a rules reading with no date or note", () => {
    expect(result).toMatchObject({ readBy: "rules", requestedDeliveryDate: null, note: null });
  });
});

describe("readOrderWithRules: splitting", () => {
  it("splits on '&'", () => {
    const lines = readOrderWithRules("2 ctn eggs & 5 packs tofu", catalogue).lines;
    expect(lines.map((line) => [line.productId, line.qty])).toEqual([["p9", 2], ["p11", 5]]);
  });

  it("splits on 'and', commas and semicolons", () => {
    const lines = readOrderWithRules("sugar and tofu, 2 sambal; 4 noodles", catalogue).lines;
    expect(lines.map((line) => line.productId)).toEqual(["p8", "p11", "p10", "p6"]);
  });

  it("returns no lines for filler only or empty text", () => {
    expect(readOrderWithRules("Hi, thanks!", catalogue).lines).toEqual([]);
    expect(readOrderWithRules("", catalogue).lines).toEqual([]);
  });
});

describe("readLineWithRules", () => {
  it("defaults to quantity 1 and marks it assumed", () => {
    expect(readOne("tofu")).toMatchObject({ productId: "p11", qty: 1, qtyAssumed: true, state: "matched" });
  });

  it("rounds a decimal quantity up to a whole number", () => {
    expect(readOne("2.5 ctn eggs")).toMatchObject({ qty: 3, qtyAssumed: false });
  });

  it("reads 'x3' before and '3x' after the product name", () => {
    expect(readOne("x3 tofu")).toMatchObject({ productId: "p11", qty: 3 });
    expect(readOne("3x tofu")).toMatchObject({ productId: "p11", qty: 3 });
  });

  it("matches an alias anywhere in the line", () => {
    expect(readOne("5 evap milk")).toMatchObject({ productId: "p5", qty: 5, state: "matched" });
    expect(readOne("1 sambal")).toMatchObject({ productId: "p10", state: "matched" });
  });

  it("is case-insensitive and strips bullets while keeping the original source text", () => {
    expect(readOne("- 2 CTN EGGS.")).toMatchObject({ sourceText: "- 2 CTN EGGS.", productId: "p9", qty: 2 });
  });

  it("ignores pack words when matching", () => {
    expect(readOne("2 btls cooking oil")).toMatchObject({ productId: "p3", qty: 2, state: "matched" });
  });

  it("treats plurals and singulars alike in token matching", () => {
    expect(readOne("dried noodle")).toMatchObject({ productId: "p6", state: "matched" });
  });

  it("asks to check when two products tie on token overlap", () => {
    expect(readOne("rice")).toMatchObject({ productId: null, options: ["p1", "p2"], state: "check" });
  });

  it("asks to check a weak partial match below the match threshold", () => {
    expect(readOne("brown rice")).toMatchObject({ productId: null, state: "check" });
  });

  it("rounds kilograms up to whole packs", () => {
    expect(readOne("7kg jasmine rice")).toMatchObject({ productId: "p1", qty: 2, kg: 7, state: "matched" });
    expect(readOne("3 kg spring onion")).toMatchObject({ productId: "p12", qty: 3, kg: 3 });
  });

  it("asks to check a kilogram order for a product without a pack weight", () => {
    expect(readOne("3kg tofu")).toMatchObject({ productId: "p11", qty: 3, kg: null, state: "check" });
  });

  it("keeps the asked weight on an unresolved line so a later choice can convert it", () => {
    const line = readOne("12kg rice");
    expect(line).toMatchObject({ productId: null, kg: 12, state: "check" });
    const p2 = catalogue.find((item) => item.id === "p2");
    if (!p2) throw new Error("missing p2");
    expect(withProduct(line, p2)).toMatchObject({ productId: "p2", qty: 3, kg: 12 });
  });

  it("caps the source text at 240 characters", () => {
    expect(readOne(`  2 tofu ${"extra ".repeat(60)}  `).sourceText).toHaveLength(240);
  });

  it("returns at most five options", () => {
    const rices = Array.from({ length: 7 }, (_, index) => product(`r${index}`, `Rice type ${index}`, "bag", 10, []));
    expect(readLineWithRules("rice", rices)?.options).toHaveLength(5);
  });

  it("returns null when only a quantity and units remain", () => {
    expect(readLineWithRules("2 ctn", catalogue)).toBeNull();
  });
});

describe("matching helpers", () => {
  it("ignores words with digits in tokens", () => {
    expect(tokens("Jasmine rice 5kg")).toEqual(["jasmine", "rice"]);
  });

  it("scores an alias hit as 1 and token overlap as 0.9 per share", () => {
    expect(rankProducts("jasmine rice", catalogue).map((hit) => [hit.item.id, hit.score])).toEqual([
      ["p1", 1],
      ["p2", 0.45],
    ]);
  });

  it("does not over-round pack conversions because of floating point", () => {
    expect(packsForWeight(1.1, 0.1)).toBe(11);
    expect(packsForWeight(0.2, 5)).toBe(1);
  });
});

describe("findSubstitute", () => {
  const jasmine = catalogue[0] as CatalogueItem;

  it("offers another product sharing a name word with enough stock", () => {
    expect(findSubstitute(jasmine, 10, catalogue)?.id).toBe("p2");
  });

  it("returns null when no similar product has enough available", () => {
    expect(findSubstitute(jasmine, 20, catalogue)).toBeNull();
  });

  it("skips unconfirmed products", () => {
    const unconfirmed = catalogue.map((item) => (item.id === "p2" ? { ...item, status: "unconfirmed" as const } : item));
    expect(findSubstitute(jasmine, 1, unconfirmed)).toBeNull();
  });
});
