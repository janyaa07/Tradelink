import { describe, expect, it } from "vitest";
import { briefingLine, customerPulse, durationText, minutesToCutoff, partOfDay, pickList, usualDay, weekPace } from "./home";

// Wednesday 4 November 2026, 13:08 in Singapore.
const wednesday = new Date("2026-11-04T05:08:00Z");

describe("home working-out", () => {
  it("names the part of the day in Singapore", () => {
    expect(partOfDay(new Date("2026-11-04T01:00:00Z"))).toBe("this morning");
    expect(partOfDay(wednesday)).toBe("this afternoon");
    expect(partOfDay(new Date("2026-11-04T12:00:00Z"))).toBe("tonight");
  });

  it("projects the week's spend from the pace so far", () => {
    // Monday 00:00 to Wednesday 13:08 is about 2.55 days.
    expect(weekPace(25500, wednesday)).toBe(Math.round((25500 / (61.1333 / 24)) * 7));
    expect(weekPace(1000, new Date("2026-11-02T00:30:00Z"))).toBe(14000);
  });

  it("adds up the same product across orders, largest first", () => {
    const list = pickList([
      { buyer: "Golden Crust", lines: [{ productId: "a", name: "Coconut milk", unit: "can", qty: 12 }, { productId: "b", name: "Ginger", unit: "bag", qty: 2 }] },
      { buyer: "Mei's", lines: [{ productId: "a", name: "Coconut milk", unit: "can", qty: 1 }] },
    ]);
    expect(list.map((line) => [line.name, line.qty])).toEqual([["Coconut milk", 13], ["Ginger", 2]]);
    expect(list[0]?.buyers).toEqual([{ name: "Golden Crust", qty: 12 }, { name: "Mei's", qty: 1 }]);
  });

  it("spots a buyer who has gone quiet and one who is ordering more", () => {
    const day = (n: number) => new Date(wednesday.getTime() - n * 86_400_000).toISOString();
    const pulse = customerPulse(
      [
        ...[6, 9, 12, 15].map((n) => ({ buyer: "Golden Crust", createdAt: day(n) })),
        ...[1, 3, 5, 8, 11, 14, 17, 20, 40, 50].map((n) => ({ buyer: "Mei's", createdAt: day(n) })),
        ...[1, 3, 5].map((n) => ({ buyer: "Lotus Leaf", createdAt: day(n) })),
        { buyer: "New Cafe", createdAt: day(2) },
      ],
      wednesday,
    );
    expect(pulse.map((entry) => [entry.buyer, entry.kind])).toEqual([
      ["Golden Crust", "quiet"],
      ["Mei's", "growing"],
      ["Lotus Leaf", "steady"],
      ["New Cafe", "new"],
    ]);
    expect(pulse[0]).toMatchObject({ daysSince: 6, usualGap: 3 });
  });

  it("compares today with the same weekday so far over the last four weeks", () => {
    const at = (iso: string, totalCents: number) => ({ createdAt: iso, totalCents });
    const result = usualDay(
      [
        at("2026-11-04T02:00:00Z", 5000),
        at("2026-10-28T02:00:00Z", 4000),
        at("2026-10-28T09:00:00Z", 9000),
        at("2026-10-21T03:00:00Z", 2000),
        at("2026-10-14T03:00:00Z", 2000),
        at("2026-10-07T03:00:00Z", 2000),
      ],
      wednesday,
    );
    expect(result).toEqual({ todayCount: 1, todayCents: 5000, usualCount: 1, usualCents: 2500 });
    expect(usualDay([], wednesday).usualCount).toBeNull();
  });

  it("counts down to the cut-off and words the briefing", () => {
    expect(minutesToCutoff("15:00:00", wednesday)).toBe(112);
    expect(minutesToCutoff("13:00", wednesday)).toBeNull();
    expect(durationText(112)).toBe("1h 52m");
    expect(durationText(45)).toBe("45m");
    expect(briefingLine([], wednesday)).toBe("Nothing needs you right now. Everything is on track.");
    expect(briefingLine(["tomorrow's order"], new Date("2026-11-04T12:00:00Z"))).toBe(
      "One thing needs you tonight: tomorrow's order. Everything else is on track.",
    );
    expect(briefingLine(["today's 3 orders to pack", "dried chillies to restock"], wednesday)).toBe(
      "Two things need you this afternoon, starting with today's 3 orders to pack.",
    );
  });
});
