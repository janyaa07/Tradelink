import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/data/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const { BUYER_TOOLS } = await import("./buyer-tools");
const { SUPPLIER_TOOLS } = await import("./supplier-tools");
const { toClaudeTool } = await import("./registry");
const { orderNumberInput } = await import("./shared");

describe("Tradelink AI tools", () => {
  it.each([
    ["buyer", BUYER_TOOLS],
    ["supplier", SUPPLIER_TOOLS],
  ])("gives every %s tool a unique name and a JSON object schema Claude accepts", (_role, tools) => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) {
      const claude = toClaudeTool(tool);
      expect(claude.name).toMatch(/^[a-z_]{2,40}$/);
      expect(claude.input_schema.type).toBe("object");
      expect(claude.input_schema).not.toHaveProperty("$schema");
      if (tool.kind === "write") expect(claude.description).toContain("confirm card");
    }
  });

  it("reads order numbers the way people write them", () => {
    expect(orderNumberInput.parse("ORD-1044")).toBe(1044);
    expect(orderNumberInput.parse("1044")).toBe(1044);
    expect(orderNumberInput.parse(1044)).toBe(1044);
    expect(orderNumberInput.safeParse("my order").success).toBe(false);
  });

  it("only lets suppliers change stock and prices, and only buyers place orders", () => {
    const buyer = new Set(BUYER_TOOLS.map((tool) => tool.name));
    const supplier = new Set(SUPPLIER_TOOLS.map((tool) => tool.name));
    expect(buyer.has("place_order") && !supplier.has("place_order")).toBe(true);
    expect(supplier.has("change_price") && !buyer.has("change_price")).toBe(true);
  });
});
