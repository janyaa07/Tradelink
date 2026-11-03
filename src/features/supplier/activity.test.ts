import { describe, expect, it } from "vitest";
import { activityHref, activityKind, activityTone, groupByDay, parseActivityFilter, timeOfDay } from "./activity";

describe("activityKind", () => {
  it("sorts entries into orders, stock and account", () => {
    expect(activityKind("Accepted ORD-1064")).toBe("order");
    expect(activityKind("Confirmed all items arrived for ORD-1058")).toBe("order");
    expect(activityKind("Received 30 of IS-3003")).toBe("stock");
    expect(activityKind("Adjusted IS-1016 by -1")).toBe("stock");
    expect(activityKind("Changed price of IS-3002 to S$1.95")).toBe("stock");
    expect(activityKind("Confirmed Tofu at S$2.00 with 10 in stock")).toBe("stock");
    expect(activityKind("Added Black pepper 500g to the catalogue")).toBe("stock");
    expect(activityKind("Updated business profile")).toBe("account");
  });

  it("marks blocked attempts and problems", () => {
    expect(activityTone({ action: "Updated business profile", denied: true })).toBe("bad");
    expect(activityTone({ action: "Rejected ORD-1060", denied: false })).toBe("warn");
    expect(activityTone({ action: "Accepted ORD-1060", denied: false })).toBe("good");
    expect(activityTone({ action: "Received 5 of IS-3003", denied: false })).toBe("info");
  });
});

describe("filters", () => {
  it("defaults to All and links to each filter", () => {
    expect(parseActivityFilter("stock")).toBe("stock");
    expect(parseActivityFilter("x")).toBe("all");
    expect(activityHref("all")).toBe("/supplier/activity");
    expect(activityHref("order")).toBe("/supplier/activity?filter=order");
  });
});

describe("groupByDay", () => {
  // 10:00 on 4 November in Singapore.
  const now = new Date("2026-11-04T02:00:00Z");

  it("groups by Singapore day and names today and yesterday", () => {
    const days = groupByDay(
      [
        { at: "2026-11-03T16:30:00Z" }, // 00:30 on 4 Nov in Singapore
        { at: "2026-11-03T15:59:00Z" }, // 23:59 on 3 Nov
        { at: "2026-11-01T04:00:00Z" },
      ],
      now,
    );
    expect(days.map((day) => [day.label, day.items.length])).toEqual([
      ["Today", 1],
      ["Yesterday", 1],
      ["Sun 1 Nov", 1],
    ]);
  });

  it("shows Singapore clock time", () => {
    expect(timeOfDay("2026-11-03T15:59:00Z")).toBe("23:59");
  });
});
